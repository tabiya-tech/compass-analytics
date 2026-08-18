import base64
import os
import subprocess
import tempfile

import yaml
from dataclasses import dataclass
from typing import Optional

import pulumi
import pulumi_gcp as gcp

from pulumi import Output

from backend._construct_api_gateway_cfg import construct_api_gateway_cfg, get_id_token
from lib import ProjectBaseConfig, get_resource_name, get_project_base_config, Version

api_gateway_config_file_name = "api_gateway_config.yaml"

CLOUD_RUN_SERVICE_NAME = "cloudrun-service"


@dataclass(frozen=True)
class BackendServiceConfig:
    """
    Environment variables for the backend service.
    See the backend service for more information on the environment variables.
    """
    analytics_mongodb_uri: str
    analytics_database_name: str
    compass_api_key: str
    compass_base_url: str
    firebase_project_id: Optional[str]
    target_environment_name: str
    target_environment_type: str | pulumi.Output[str]
    backend_url: str | pulumi.Output[str]
    frontend_url: str | pulumi.Output[str]
    sentry_dsn: Optional[str]
    sentry_config: Optional[str]
    enable_sentry: str
    version_date: Optional[str]
    version_branch: Optional[str]
    version_build_number: Optional[str]
    version_sha: Optional[str]
    cloudrun_max_instance_request_concurrency: int
    cloudrun_min_instance_count: int
    cloudrun_max_instance_count: int
    cloudrun_request_timeout: str
    cloudrun_memory_limit: str
    cloudrun_cpu_limit: str
    api_gateway_timeout: str
    api_gateway_rate_limit: str


def _write_env_vars_file(cfg: BackendServiceConfig) -> str:
    """
    Write Cloud Run env vars to a temp YAML file for --env-vars-file.
    This avoids comma-delimiter issues with --set-env-vars when values
    contain commas (e.g. BACKEND_SENTRY_CONFIG JSON).
    Returns the path to the temp file.
    """
    entries = {k: v for k, v in [
        ("ANALYTICS_MONGODB_URI", cfg.analytics_mongodb_uri),
        ("ANALYTICS_DATABASE_NAME", cfg.analytics_database_name),
        ("COMPASS_API_KEY", cfg.compass_api_key),
        ("COMPASS_BASE_URL", cfg.compass_base_url),
        ("FIREBASE_PROJECT_ID", cfg.firebase_project_id),
        ("TARGET_ENVIRONMENT_NAME", cfg.target_environment_name),
        ("TARGET_ENVIRONMENT_TYPE", cfg.target_environment_type),
        ("BACKEND_URL", cfg.backend_url),
        ("FRONTEND_URL", cfg.frontend_url),
        ("BACKEND_ENABLE_SENTRY", cfg.enable_sentry),
        ("BACKEND_SENTRY_DSN", cfg.sentry_dsn),
        ("BACKEND_SENTRY_CONFIG", cfg.sentry_config),
        ("VERSION_DATE", cfg.version_date),
        ("VERSION_BRANCH", cfg.version_branch),
        ("VERSION_BUILD_NUMBER", cfg.version_build_number),
        ("VERSION_SHA", cfg.version_sha),
    ] if v is not None}

    for k, v in entries.items():
        if not isinstance(v, str):
            raise TypeError(f"env var {k} must be a plain str before writing to --env-vars-file, got {type(v)}")
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False)
    yaml.dump(entries, tmp, default_flow_style=False, allow_unicode=True)
    tmp.close()
    return tmp.name


def build_gcloud_deploy_command(
        *,
        source_dir: str,
        project: str,
        region: str,
        service_account_email: str,
        network_id: str,
        subnet_id: str,
        cfg: BackendServiceConfig,
) -> tuple[list[str], str]:
    """
    Build the `gcloud run deploy --source` command that Cloud Build uses to build the Docker image
    and deploy it to Cloud Run. Cloud Build automatically manages an Artifact Registry repo in the
    deployment project — no shared realm-level AR is needed.

    Returns (cmd, env_vars_file_path) — the caller must delete the temp file after the command runs.
    """
    env_vars_file = _write_env_vars_file(cfg)

    cmd = [
        "gcloud", "run", "deploy", CLOUD_RUN_SERVICE_NAME,
        f"--source={source_dir}",
        f"--project={project}",
        f"--billing-project={project}",
        f"--region={region}",
        "--platform=managed",
        "--no-allow-unauthenticated",
        f"--memory={cfg.cloudrun_memory_limit}",
        f"--cpu={cfg.cloudrun_cpu_limit}",
        f"--min-instances={cfg.cloudrun_min_instance_count}",
        f"--max-instances={cfg.cloudrun_max_instance_count}",
        f"--concurrency={cfg.cloudrun_max_instance_request_concurrency}",
        f"--timeout={cfg.cloudrun_request_timeout}",
        "--execution-environment=gen2",
        f"--env-vars-file={env_vars_file}",
    ]

    if service_account_email:
        cmd.append(f"--service-account={service_account_email}")

    if network_id and subnet_id:
        cmd += [
            f"--network={network_id}",
            f"--subnet={subnet_id}",
            "--vpc-egress=all-traffic",
        ]

    return cmd, env_vars_file


def _get_cloud_run_service_uri(*, project: str, region: str) -> str:
    """Fetch the URI of the already-deployed Cloud Run service via gcloud."""
    result = subprocess.run(
        ["gcloud", "run", "services", "describe", CLOUD_RUN_SERVICE_NAME,
         f"--project={project}", f"--billing-project={project}", f"--region={region}",
         "--format=value(status.url)"],
        capture_output=True, text=True, check=True,
    )
    return result.stdout.strip()


def _setup_api_gateway(*,
                       basic_config: ProjectBaseConfig,
                       cloudrun_uri: pulumi.Output[str],
                       cloudrun_name: pulumi.Output[str],
                       id_token_str: str,
                       backend_service_cfg: BackendServiceConfig,
                       dependencies: list[pulumi.Resource],
                       artifacts_version: Version):
    apigw_service_account = gcp.serviceaccount.Account(
        resource_name=get_resource_name(resource="api-gateway", resource_type="sa"),
        account_id="api-gateway-sa",
        project=basic_config.project,
        display_name="API Gateway Service Account",
        create_ignore_already_exists=True,
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider),
    )

    apigw_api = gcp.apigateway.Api(
        resource_name=get_resource_name(resource="api-gateway", resource_type="api"),
        api_id="backend-api-gateway-api",
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider),
    )

    apigw_config_yml_string = cloudrun_uri.apply(
        lambda cloudrun_url: construct_api_gateway_cfg(cloud_run_url=cloudrun_url,
                                                       id_token_str=id_token_str,
                                                       expected_version=artifacts_version))

    firebase_project_id = backend_service_cfg.firebase_project_id
    if not firebase_project_id:
        raise ValueError("FIREBASE_PROJECT_ID is required — it is used as the JWT issuer in the API Gateway config.")

    apigw_config_yaml = pulumi.Output.all(cloudrun_uri, apigw_config_yml_string).apply(
        lambda args:
        args[1]
        .replace('__PROJECT_ID__', firebase_project_id)
        .replace('__BACKEND_URI__', args[0])
        .replace("__API_GATEWAY_TIMEOUT__", backend_service_cfg.api_gateway_timeout)
        .replace("__ENVIRONMENT_NAME__", backend_service_cfg.target_environment_name)
        .replace("__API_GATEWAY_RATE_LIMIT__", backend_service_cfg.api_gateway_rate_limit)
    )

    apigw_config_yaml_b64encoded = apigw_config_yaml.apply(lambda yaml: base64.b64encode(yaml.encode()).decode())

    apigw_config = gcp.apigateway.ApiConfig(
        resource_name=get_resource_name(resource="api-gateway", resource_type="api-config"),
        api=apigw_api.api_id,
        project=basic_config.project,
        openapi_documents=[
            gcp.apigateway.ApiConfigOpenapiDocumentArgs(
                document=gcp.apigateway.ApiConfigOpenapiDocumentDocumentArgs(
                    path=api_gateway_config_file_name,
                    contents=apigw_config_yaml_b64encoded,
                ),
            )
        ],
        gateway_config=gcp.apigateway.ApiConfigGatewayConfigArgs(
            backend_config=gcp.apigateway.ApiConfigGatewayConfigBackendConfigArgs(
                google_service_account=apigw_service_account.email
            )
        ),
        opts=pulumi.ResourceOptions(provider=basic_config.provider)
    )

    api_gateway = gcp.apigateway.Gateway(
        resource_name=get_resource_name(resource="api-gateway"),
        api_config=apigw_config.id,
        display_name="Backend API Gateway",
        gateway_id="backend-api-gateway",
        project=basic_config.project,
        region=basic_config.location,
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider),
    )

    # Restrict direct Cloud Run access — only the API Gateway SA may invoke it
    gcp.cloudrun.IamMember(
        resource_name=get_resource_name(resource="api-gateway-sa", resource_type="iam-member"),
        project=basic_config.project,
        location=basic_config.location,
        service=cloudrun_name,
        role="roles/run.invoker",
        member=apigw_service_account.email.apply(lambda email: f"serviceAccount:{email}"),
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider),
    )

    gcp.projects.Service(
        get_resource_name(resource="analytics-backend-api", resource_type="service"),
        project=basic_config.project,
        service=apigw_api.managed_service,
        opts=pulumi.ResourceOptions(depends_on=[api_gateway], provider=basic_config.provider)
    )

    pulumi.export("apigateway_url", api_gateway.default_hostname.apply(lambda hostname: f"https://{hostname}"))
    pulumi.export("apigateway_id", api_gateway.gateway_id)
    return api_gateway


def _setup_nat_gateway(*,
                       basic_config: ProjectBaseConfig,
                       labels: dict,
                       ) -> tuple[gcp.compute.Network, gcp.compute.Subnetwork, list[pulumi.Resource]]:
    """
    Sets up a NAT Gateway so all Cloud Run egress exits through a static IP.
    ref: https://docs.cloud.google.com/run/docs/configuring/static-outbound-ip
    """
    network = gcp.compute.Network(
        get_resource_name(resource="nat-gateway", resource_type="network"),
        auto_create_subnetworks=False,
        opts=pulumi.ResourceOptions(provider=basic_config.provider))

    sub_net = gcp.compute.Subnetwork(
        get_resource_name(resource="nat-gateway", resource_type="sub-network"),
        ip_cidr_range="10.0.0.0/26",
        region=basic_config.location,
        network=network.id,
        opts=pulumi.ResourceOptions(provider=basic_config.provider, depends_on=[network]))

    static_ip = gcp.compute.Address(
        get_resource_name(resource="nat-gateway", resource_type="static-ip"),
        region=basic_config.location,
        labels=labels,
        opts=pulumi.ResourceOptions(provider=basic_config.provider, protect=True))

    router = gcp.compute.Router(
        get_resource_name(resource="nat-gateway", resource_type="router"),
        network=network.id,
        region=basic_config.location,
        opts=pulumi.ResourceOptions(provider=basic_config.provider, depends_on=[network])
    )

    router_nat = gcp.compute.RouterNat(
        get_resource_name(resource="nat-gateway", resource_type="nat"),
        router=router.name,
        nat_ip_allocate_option="MANUAL_ONLY",
        nat_ips=[static_ip.id],
        region=basic_config.location,
        source_subnetwork_ip_ranges_to_nat="ALL_SUBNETWORKS_ALL_IP_RANGES",
        opts=pulumi.ResourceOptions(provider=basic_config.provider, depends_on=[router, sub_net, network]))

    pulumi.export("cloudrun_nat_gateway_egress_static_ip", static_ip.address)
    return network, sub_net, [router_nat]


def _create_backend_service_account(
        *,
        basic_config: ProjectBaseConfig,
        dependencies: list[pulumi.Resource],
) -> gcp.serviceaccount.Account:
    return gcp.serviceaccount.Account(
        get_resource_name(resource="backend", resource_type="sa"),
        account_id="backend-sa",
        display_name="The dedicated service account for the Compass Analytics backend service",
        create_ignore_already_exists=True,
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider),
    )


def deploy_backend(
        *,
        location: str,
        project: str | Output[str],
        project_id: str,
        backend_service_cfg: BackendServiceConfig,
        deployable_version: Version,
        labels: dict,
):
    """
    Deploy the backend infrastructure.

    The Cloud Run service itself is built and deployed by `scripts/up.py` via
    `gcloud run deploy --source` (Cloud Build manages the image in a per-project AR repo).
    This Pulumi stack is responsible for the surrounding infrastructure:
      - NAT gateway (static egress IP)
      - Backend service account
      - API Gateway (Firebase JWT verification, rate limiting, Cloud Run invoker binding)

    The Cloud Run service is imported as an existing resource so the API Gateway can
    reference its URI without re-deploying it.
    """
    basic_config = get_project_base_config(project=project, location=location)

    nat_network, nat_sub_network, nat_dependencies = _setup_nat_gateway(basic_config=basic_config, labels=labels)

    service_account = _create_backend_service_account(
        basic_config=basic_config,
        dependencies=nat_dependencies,
    )

    # Import the Cloud Run service that was deployed by gcloud run deploy --source.
    # The service already exists; Pulumi tracks it for state and so the API Gateway
    # can reference its URI and name.
    cloudrun_service = gcp.cloudrunv2.Service.get(
        get_resource_name(resource="cloudrun", resource_type="service"),
        id=Output.all(basic_config.project, location).apply(
            lambda args: f"projects/{args[0]}/locations/{args[1]}/services/{CLOUD_RUN_SERVICE_NAME}"
        ),
        opts=pulumi.ResourceOptions(provider=basic_config.provider),
    )

    pulumi.export("cloud_run_url", cloudrun_service.uri)

    # Fetch the Cloud Run URL and ID token eagerly — before entering any Pulumi apply()
    # callback — because google.auth.default() and fetch_id_token both fail under WIF
    # inside async apply contexts.
    cloudrun_url_plain = _get_cloud_run_service_uri(project=project_id, region=location)
    id_token_str = get_id_token(cloudrun_url_plain)

    _setup_api_gateway(
        basic_config=basic_config,
        cloudrun_uri=cloudrun_service.uri,
        cloudrun_name=cloudrun_service.name,
        id_token_str=id_token_str,
        artifacts_version=deployable_version,
        backend_service_cfg=backend_service_cfg,
        dependencies=[cloudrun_service, service_account],
    )

    # Export nat network/subnet IDs so scripts/up.py can pass them to gcloud run deploy --source
    pulumi.export("nat_network_id", nat_network.id)
    pulumi.export("nat_subnet_id", nat_sub_network.id)
    pulumi.export("backend_sa_email", service_account.email)
