# Compass Analytics Backend

FastAPI + Pydantic backend for the Compass Analytics dashboard.

## Setup

Requires Python 3.11 and [Poetry](https://python-poetry.org/).

```bash
poetry install
cp .env.example .env  # then fill in real values
poetry run uvicorn app.server:app --reload --port 8080
```

## Scripts

| Command | What it does |
| --- | --- |
| `poetry run uvicorn app.server:app --reload --port 8080` | Run the dev server |
| `poetry run pylint --recursive=y .` | Lint |
| `poetry run bandit -c bandit.yaml -r .` | Security scan |
| `poetry run pytest -m "not smoke_test"` | Run unit/integration tests |
| `poetry run pytest -m smoke_test` | Run smoke tests against a deployed environment |

## Granting yourself access (bootstrap users)

In a fresh local or dev environment, the database has no users provisioned — every login will 404 on `/api/me`. The bootstrap script seeds grants directly into MongoDB so you can access the dashboard without going through the full user-provisioning flow.

### 1. Register on the UI

Start the app locally (or point at a deployed dev environment) and sign up via the login page. Firebase creates your account; a sign-in that ends in a 404/403 is expected at this point — you just need the account to exist so Firebase assigns you a UID.

### 2. Find your Firebase UID

Use one of:

- **Backend logs** — after a sign-in attempt, the backend logs the incoming JWT subject. Look for a line containing `user_id` or `sub` with a value like `rl8BuwNyjzfWl0P5n3OY0CdoGbE3`.
- **Firebase console** — Authentication → Users → find your email → copy the **User UID** column.
- **Chrome Dev tools** — Look in the dev tools network tab for requests going out. Most requests headed towards the backend will have a JWT token with the user_id in it. Decode the token to find your user_id

### 3. Create a `users.csv` file

Required columns: `user_id`, `role`. `institution_id` is optional and defaults to `*` (all institutions) for `super_admin` and `funder`.

```csv
user_id,role,institution_id
<your-firebase-uid>,super_admin,
```

Valid roles:

| Role | Access | `institution_id` required? |
|------|--------|---------------------------|
| `super_admin` | Everything, all institutions | No |
| `funder` | Cross-institution dashboard + access management | No |
| `institution_admin` | Single institution — full visibility + access management | Yes |
| `implementer` | Single institution — dashboard + jobseekers | Yes |

### 4. Run the script

```bash
poetry run python -m scripts.bootstrap_users path/to/users.csv
```

The script validates all rows before writing anything and upserts each grant idempotently — safe to re-run.

### 5. Sign in again

Reload the app and sign in — you should land on the dashboard instead of getting a 404.

---

## Testing

Tests are colocated with source (`*_test.py`), not in a separate `tests/` directory. Tests requiring MongoDB use
an in-memory Mongo instance (`pymongo_inmemory`) via fixtures in `conftest.py` — no real database needed to run
the suite locally.

See [testing-guidelines.md](../testing-guidelines.md) for BDD test-writing conventions.
