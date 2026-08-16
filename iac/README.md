# compass-analytics IAC

Pulumi (Python) infrastructure for compass-analytics.  
Deployments are served at **`<deployment>.analytics.tabiya.tech`** — e.g. `zambia.analytics.tabiya.tech`.

---

## Architecture

```
GitHub push ──▶ main.yml ──▶ frontend-ci + backend-ci (test; on main/[pulumi up]: build + push)
                                      │
                                      ▼ (on main or [pulumi up])
                                  deploy.yml (WIF → prepare.py → up.py)
                                      │
  ┌──────────┬─────────────┬──────────────┬──────────────┬──────────────┐
  ▼          ▼             ▼              ▼              ▼              ▼
realm    environment      dns          backend        frontend       common
(GCP     (GCP project   (analytics   Cloud Run      GCS bucket    Global LB +
folder,  per deploy +    .tabiya.tech  + API          + CDN (SPA)  managed SSL +
AR)      API enable)     zone + sub-   Gateway                     DNS A record
                         domain)       (JWT auth)
  └──────────────── <deployment>.analytics.tabiya.tech ────────────────────┘
                  /api/* → API Gateway → Cloud Run
                  /*     → frontend bucket
```

**Stack naming:** `analytics.<deployment>` in Pulumi org `tabiya-tech`  
**Pulumi project names:** `analytics-realm`, `analytics-environment`, `analytics-dns`, `analytics-backend`, `analytics-frontend`, `analytics-common`  
**Artifact Registry:** docker repo (`analytics-backend:<branch>-<sha>`) and generic repo (`frontend-build.tar.gz`) live in the realm's root project.

---

## Directory layout

```
iac/
├── lib/              # shared helpers (getconfig, getstackref, getenv, …)
├── realm/            # one-time GCP org setup (folder hierarchy, AR repos, groups)
├── environment/      # per-deployment GCP project + API enablement
├── dns/              # Cloud DNS zone + subdomain records + Route53 NS delegation
├── backend/          # Cloud Run + API Gateway (JWT + rate limiting)
├── frontend/         # GCS bucket + CDN (static Vite SPA)
├── common/           # Global LB + managed SSL cert + DNS A record
├── scripts/          # prepare.py, up.py, destroy.py, build scripts, formatters
├── config/
│   ├── .env.example             # secrets template (fill in, store in Secret Manager)
│   └── stack_config.template.yaml  # per-stack Pulumi config template
└── templates/        # copies of config/ used by prepare.py for validation
```

---

## Prerequisites (local dev)

```bash
# From the iac/ directory
python3 -m venv venv-iac
source venv-iac/bin/activate
pip install -r requirements.txt

pulumi login          # authenticates to Pulumi Cloud
pulumi org set-default tabiya-tech

gcloud auth application-default login   # or use a SA key locally
```

---

## One-time GCP setup (bootstrap — run once per realm)

These steps are performed **once** when standing up a new analytics realm.  
They require org-level admin credentials.

### 1. GCP org structure

Create the following manually (or via a bootstrap script) before running the realm stack:

- A **root folder** for the analytics realm (e.g. `Analytics`) inside the Tabiya GCP org
- A **root project** inside that folder (e.g. `analytics-realm-root`) — this is where Artifact Registry and Secret Manager live
- Two **sub-folders** inside the root folder:
  - `Lower Environments` (dev/test)
  - `Prod Environments`
- Two **Google OAuth project folders** (pre-existing in your org, referenced by `gcp_upper_env_google_oauth_projects_folder_id` / `gcp_lower_env_google_oauth_projects_folder_id`)
- Enable billing on the root project

### 2. Run the realm stack

Create the realm Pulumi stack and set its config:

```bash
cd iac/realm
pulumi stack init analytics   # stack name = realm name

pulumi config set gcp:region europe-west1
pulumi config set gcp_customer_id         <YOUR_GCP_CUSTOMER_ID>
pulumi config set gcp_billing_account_id  <BILLING_ACCOUNT_ID>
pulumi config set gcp_organization_id     <ORG_ID>
pulumi config set gcp_root_folder_id      <ROOT_FOLDER_ID>
pulumi config set gcp_root_project_id     analytics-realm-root
pulumi config set gcp_upper_env_google_oauth_projects_folder_id  <UPPER_OAUTH_FOLDER_ID>
pulumi config set gcp_lower_env_google_oauth_projects_folder_id  <LOWER_OAUTH_FOLDER_ID>
pulumi config set base_domain_name        analytics.tabiya.tech

pulumi up
```

This creates:
- `analytics-developers` and `analytics-admins` Google groups
- `docker-repository` and `generic-repository` in Artifact Registry
- `environments-config` Secret Manager secret
- `Lower Environments` and `Prod Environments` sub-folders with IAM grants

### 3. DNS — analytics.tabiya.tech managed zone

The `dns` stack creates per-deployment subdomain records inside the `analytics.tabiya.tech` Cloud DNS zone.  
The zone itself must exist first (the `dns` stack does **not** create it):

```bash
gcloud dns managed-zones create analytics-tabiya-tech \
  --project=analytics-realm-root \
  --dns-name=analytics.tabiya.tech. \
  --description="Analytics deployments zone"
```

Then delegate from the `tabiya.tech` root (hosted in Route53):

```bash
# Get the NS records Cloud DNS assigned to the new zone
gcloud dns managed-zones describe analytics-tabiya-tech \
  --project=analytics-realm-root \
  --format="value(nameServers)"

# In Route53 console (or via AWS CLI): add an NS record for analytics.tabiya.tech
# pointing to the four nameservers above.
```

### 4. Workload Identity Federation

Create a WIF pool and provider bound to this GitHub repo (do once per env tier — lower and prod):

```bash
PROJECT=analytics-realm-root
REPO=tabiya-tech/compass-analytics

# WIF pool
gcloud iam workload-identity-pools create analytics-github \
  --project=$PROJECT \
  --location=global \
  --display-name="Analytics GitHub Actions"

# OIDC provider
gcloud iam workload-identity-pools providers create-oidc analytics-github-provider \
  --project=$PROJECT \
  --location=global \
  --workload-identity-pool=analytics-github \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${REPO}'"

# Deploy service account (lower envs)
gcloud iam service-accounts create analytics-deploy-lower \
  --project=$PROJECT \
  --display-name="Analytics deploy SA (lower envs)"

# Required roles on the SA
for ROLE in \
  roles/run.admin \
  roles/apigateway.admin \
  roles/storage.admin \
  roles/compute.loadBalancerAdmin \
  roles/dns.admin \
  roles/artifactregistry.writer \
  roles/iam.serviceAccountUser \
  roles/secretmanager.secretAccessor \
  roles/resourcemanager.projectCreator \
  roles/serviceusage.serviceUsageAdmin; do
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:analytics-deploy-lower@${PROJECT}.iam.gserviceaccount.com" \
    --role=$ROLE
done

# Allow the GitHub repo to impersonate the SA
POOL_ID=$(gcloud iam workload-identity-pools describe analytics-github \
  --project=$PROJECT --location=global --format="value(name)")

gcloud iam service-accounts add-iam-policy-binding \
  analytics-deploy-lower@${PROJECT}.iam.gserviceaccount.com \
  --project=$PROJECT \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/${POOL_ID}/attribute.repository/${REPO}"
```

Repeat for a `analytics-deploy-prod` SA for the upper/prod tier.

Record the WIF provider resource name and SA emails — you will need them in the next step.

### 5. Pulumi stacks

Create stacks for each deployment (repeat for each new deployment, e.g. `zambia`, `mozambique`):

```bash
for MODULE in environment dns backend frontend common; do
  cd iac/$MODULE
  pulumi stack init analytics.zambia
  cd -
done
```

The `realm` stack uses just the realm name as its stack name (`analytics`).

---

## Adding a new deployment

1. **Create GCP project secrets.** In the GCP project for the deployment, create two secrets:

   - `env-vars` — contents from `iac/config/.env.example` filled in with real values
   - `stack-config` — contents from `iac/config/stack_config.template.yaml` tuned for the deployment

2. **Register the environment** in the `environments-config` secret of the realm's root project.  
   `prepare.py` reads this secret to discover which deployments exist and their GCP project IDs.

3. **Create Pulumi stacks** (see step 5 above).

4. **Set GitHub repo variables** (see the GitHub settings section below).

5. **Trigger a deploy** — push to `main` or include `[pulumi up]` in a commit message, or dispatch `deploy.yml` manually.

---

## GitHub repository settings

Set these in **Settings → Secrets and variables → Actions** on the GitHub repo.

### Variables

| Name | Example value | Description |
|------|--------------|-------------|
| `REALM_NAME` | `analytics` | Pulumi realm stack name |
| `ARTIFACT_REGISTRY_REGION` | `europe-west1` | Region of the Artifact Registry |
| `GCP_REALM_ROOT_PROJECT_ID` | `analytics-realm-root` | Root project where AR lives |
| `WIF_PROVIDER_LOWER` | `projects/123/locations/global/workloadIdentityPools/analytics-github/providers/analytics-github-provider` | WIF provider resource name for lower envs |
| `WIF_PROVIDER_PROD` | _(same form, prod pool)_ | WIF provider resource name for prod |
| `DEPLOY_SA_LOWER` | `analytics-deploy-lower@analytics-realm-root.iam.gserviceaccount.com` | Deploy SA for lower envs |
| `DEPLOY_SA_PROD` | `analytics-deploy-prod@analytics-realm-root.iam.gserviceaccount.com` | Deploy SA for prod |

### Secrets

| Name | Description |
|------|-------------|
| `PULUMI_ACCESS_TOKEN` | Pulumi Cloud access token |
| `AWS_DNS_UPDATE_ACCESS_KEY` | AWS key with Route53 write access for `analytics.tabiya.tech` NS delegation |
| `AWS_DNS_UPDATE_SECRET_ACCESS_KEY` | Corresponding AWS secret key |
| `SENTRY_AUTH_TOKEN` | (Optional) Sentry token for sourcemap upload; upload is skipped if absent |

---

## Deploy flow

### Automatic (CI-driven)

Every push to `main` (or any commit containing `[pulumi up]` in its message):

1. `frontend-ci` and `backend-ci` run tests, then build and push artifacts to Artifact Registry.
2. `deploy` (depends on both) runs `prepare.py` then `up.py` with `env-type: dev`.

### Manual

Use **Actions → Deploy → Run workflow** to target a specific deployment or env tier:

- `env-type`: `dev` | `test` | `prod`
- `env-name`: specific deployment name (e.g. `zambia`); omit to deploy all environments of that type
- `target-git-branch` / `target-git-sha`: the commit to deploy (image + tarball must already be in AR)

### What `prepare.py` does

For each targeted deployment:
1. Reads `env-vars` and `stack-config` secrets from the deployment's GCP project.
2. Validates them against the templates in `iac/templates/`.
3. Writes `.env.<stack>` and per-module `Pulumi.<stack>.yaml` files.
4. Downloads the frontend build tarball from Artifact Registry.

### What `up.py` does

Runs `pulumi up` in order: `environment → dns → frontend → backend → common`, then smoke-tests:
- `GET https://<deployment>.analytics.tabiya.tech/api/version` — checks SHA matches the deployed commit
- `GET https://<deployment>.analytics.tabiya.tech/data/version.json` — checks frontend version

---

## Building artifacts locally

```bash
# Backend Docker image
./iac/scripts/build-and-upload-be.sh <region> <realm-root-project-id> /dev/stdout <run-number>

# Frontend tarball
./iac/scripts/build-and-upload-fe.sh <region> <realm-root-project-id> /dev/stdout <run-number>
```

Both scripts read the git branch/SHA from the current repo state and push to the analytics Artifact Registry.

---

## Secrets layout in Secret Manager

Per-deployment secrets live in the **deployment's own GCP project** (not the realm root):

| Secret ID | Content |
|-----------|---------|
| `env-vars` | Key=value env file (see `iac/config/.env.example`) |
| `stack-config` | YAML per-stack Pulumi config (see `iac/config/stack_config.template.yaml`) |

The realm root project holds:

| Secret ID | Content |
|-----------|---------|
| `environments-config` | JSON mapping of environment names → GCP project IDs, used by `prepare.py` to discover deployments |

Secrets are versioned; `prepare.py` always reads the `main` version alias. Rotate secrets by adding a new version and updating the `main` alias.

---

## Rollback

Re-dispatch `deploy.yml` with a previous `target-git-sha`.  
The corresponding Docker image and frontend tarball are retained in Artifact Registry by tag, so re-deploying an old SHA just pulls the existing artifacts.
