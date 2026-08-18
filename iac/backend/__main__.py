import sys
import os
import pulumi

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/backend directory.
sys.path.insert(0, libs_dir)

from deploy_backend import deploy_backend, BackendServiceConfig
from lib import getconfig, getstackref, getenv, parse_realm_env_name_from_stack, load_dot_realm_env, Version
from lib.std_pulumi import get_labels


def main():
    # The environment is the stack name
    realm_name, environment_name, stack_name = parse_realm_env_name_from_stack()

    # Load environment variables
    load_dot_realm_env(stack_name)

    # Get the config values
    location = getconfig("region", "gcp")
    pulumi.info(f'Using location: {location}')
    pulumi.export("location", location)

    cloudrun_max_instance_request_concurrency: int = int(getconfig("max_instance_request_concurrency", "cloudrun"))
    cloudrun_min_instance_count: int = int(getconfig("min_instance_count", "cloudrun"))
    cloudrun_max_instance_count: int = int(getconfig("max_instance_count", "cloudrun"))
    cloudrun_request_timeout: str = str(getconfig("request_timeout", "cloudrun"))
    cloudrun_memory_limit: str = getconfig("memory_limit", "cloudrun")
    cloudrun_cpu_limit: str = str(getconfig("cpu_limit", "cloudrun"))

    api_gateway_timeout: str = str(getconfig("timeout", "api_gateway"))
    api_gateway_rate_limit: str = str(getconfig("rate_limit", "api_gateway"))

    # Get stack references
    env_reference = pulumi.StackReference(f"tabiya-tech/analytics-environment/{stack_name}")
    project = getstackref(env_reference, "project_id")
    environment_type = getstackref(env_reference, "environment_type")

    backend_url = getstackref(env_reference, "backend_url")
    frontend_url = getstackref(env_reference, "frontend_url")

    # Get backend service configuration
    backend_service_cfg = BackendServiceConfig(
        analytics_mongodb_uri=getenv("ANALYTICS_MONGODB_URI", True),
        analytics_database_name=getenv("ANALYTICS_DATABASE_NAME"),
        compass_api_key=getenv("COMPASS_API_KEY", True),
        compass_base_url=getenv("COMPASS_BASE_URL"),
        firebase_project_id=getenv("FIREBASE_PROJECT_ID", False, False),
        target_environment_name=environment_name,
        target_environment_type=environment_type,
        backend_url=backend_url,
        frontend_url=frontend_url,
        sentry_dsn=getenv("BACKEND_SENTRY_DSN", True, False),
        sentry_config=getenv("BACKEND_SENTRY_CONFIG", False, False),
        enable_sentry=getenv("BACKEND_ENABLE_SENTRY"),

        version_date=getenv("VERSION_DATE", False, False),
        version_branch=getenv("VERSION_BRANCH", False, False),
        version_build_number=getenv("VERSION_BUILD_NUMBER", False, False),
        version_sha=getenv("VERSION_SHA", False, False),

        cloudrun_max_instance_request_concurrency=cloudrun_max_instance_request_concurrency,
        cloudrun_min_instance_count=cloudrun_min_instance_count,
        cloudrun_max_instance_count=cloudrun_max_instance_count,
        cloudrun_request_timeout=cloudrun_request_timeout,
        cloudrun_memory_limit=cloudrun_memory_limit,
        cloudrun_cpu_limit=cloudrun_cpu_limit,
        api_gateway_timeout=api_gateway_timeout,
        api_gateway_rate_limit=api_gateway_rate_limit,
    )

    # version of the artifacts to deploy
    deployable_version = Version(
        git_branch_name=getenv("TARGET_GIT_BRANCH_NAME"),
        git_sha=getenv("TARGET_GIT_SHA")
    )

    labels = get_labels(realm_name=realm_name, environment_name=environment_name)

    # Deploy the backend infrastructure.
    # The Cloud Run service itself is deployed by scripts/up.py via gcloud run deploy --source
    # before pulumi up runs. This stack handles the API Gateway, NAT, and service account.
    deploy_backend(
        project=project,
        project_id=getenv("DEPLOYMENT_PROJECT_ID"),
        location=location,
        backend_service_cfg=backend_service_cfg,
        deployable_version=deployable_version,
        labels=labels,
    )


if __name__ == "__main__":
    main()
