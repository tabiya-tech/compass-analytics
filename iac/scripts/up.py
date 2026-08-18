#!/usr/bin/env python3
import dataclasses
import datetime
import os
import subprocess
import sys
import argparse
import time
from typing import Optional
import pulumi.automation as auto

import requests


# Determine the absolute path to the 'iac' directory
iac_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
repo_dir = os.path.abspath(os.path.join(iac_dir, '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/scripts directory.
sys.path.insert(0, iac_dir)

from environment.env_types import EnvironmentTypes
from _types import IaCModules, Environment
from frontend.prepare_frontend import prepare_frontend
from lib import load_dot_realm_env, getenv, get_pulumi_stack_outputs, Version, clear_dot_env
from _common import add_select_environments_arguments, run_pulumi_up, find_environments
from backend.deploy_backend import BackendServiceConfig, build_gcloud_deploy_command


def _run_smoke_tests(version_json_url: str, max_retries: int = 10):
    artifacts_version = Version(
        git_branch_name=getenv("TARGET_GIT_BRANCH_NAME"),
        git_sha=getenv("TARGET_GIT_SHA")
    )

    print(f"info: running the smoke tests on {version_json_url} and expected version is {artifacts_version}")

    version_json_response: Optional[requests.Response] = None

    for _i in range(max_retries):
        try:
            version_json_response = requests.get(version_json_url, timeout=30)
            if version_json_response.status_code == 200:
                if version_json_response.status_code == 200:break
            print(f"info: retrying after 10 seconds the request to {version_json_url} "
                  f"due to non-200 status: {version_json_response.status_code}")
            time.sleep(10)
        except requests.exceptions.SSLError:
            print(f"info: retrying after 10 seconds the request to {version_json_url} due to SSL error.")
            time.sleep(10)

    assert version_json_response is not None
    assert version_json_response.status_code == 200

    version_json = version_json_response.json()
    assert version_json["sha"] == artifacts_version.git_sha
    assert version_json["branch"] == artifacts_version.git_branch_name

    print("info: smoke tests passed successfully.")


def _deploy_frontend(stack_name: str):
    # prepare the frontend to be deployed.
    prepare_frontend(stack_name=stack_name)

    # run pulumi up for the frontend stack.
    up_results = run_pulumi_up(stack_name, IaCModules.FRONTEND)

    # run the smoke tests for the frontend.
    bucket_url = up_results.outputs["bucket_url"].value
    _run_smoke_tests(f"{bucket_url}/data/version.json")


def _gcloud_deploy_backend(*, stack_name: str):
    """
    Build the backend Docker image via Cloud Build and deploy to Cloud Run using
    `gcloud run deploy --source`. Cloud Build manages a Google-owned Artifact Registry
    repo in the deployment project — no shared realm-level AR is needed.

    The NAT network/subnet and backend SA must already exist (created by a prior
    `pulumi up backend` run or on the first deploy they are created together with
    Cloud Run via this call).  On first deploy we use Direct VPC so we pass the
    network/subnet via `gcloud run deploy` flags and let Cloud Build create the AR repo.
    """
    # Pull the environment variables that carry deployment metadata.
    env_vars_cfg = BackendServiceConfig(
        analytics_mongodb_uri=getenv("ANALYTICS_MONGODB_URI", True),
        analytics_database_name=getenv("ANALYTICS_DATABASE_NAME"),
        compass_api_key=getenv("COMPASS_API_KEY", True),
        compass_base_url=getenv("COMPASS_BASE_URL"),
        firebase_project_id=getenv("FIREBASE_PROJECT_ID", False, False),
        target_environment_name=stack_name.split(".")[-1],
        target_environment_type="prod",
        backend_url="",
        frontend_url="",
        sentry_dsn=getenv("BACKEND_SENTRY_DSN", True, False),
        sentry_config=getenv("BACKEND_SENTRY_CONFIG", False, False),
        enable_sentry=getenv("BACKEND_ENABLE_SENTRY"),
        version_date=getenv("VERSION_DATE", False, False),
        version_branch=getenv("VERSION_BRANCH", False, False),
        version_build_number=getenv("VERSION_BUILD_NUMBER", False, False),
        version_sha=getenv("VERSION_SHA", False, False),
        cloudrun_max_instance_request_concurrency=int(os.getenv("CLOUDRUN_MAX_CONCURRENCY", "80")),
        cloudrun_min_instance_count=int(os.getenv("CLOUDRUN_MIN_INSTANCES", "0")),
        cloudrun_max_instance_count=int(os.getenv("CLOUDRUN_MAX_INSTANCES", "5")),
        cloudrun_request_timeout=os.getenv("CLOUDRUN_REQUEST_TIMEOUT", "300s"),
        cloudrun_memory_limit=os.getenv("CLOUDRUN_MEMORY_LIMIT", "1Gi"),
        cloudrun_cpu_limit=os.getenv("CLOUDRUN_CPU_LIMIT", "2"),
        api_gateway_timeout=os.getenv("API_GATEWAY_TIMEOUT", "60s"),
        api_gateway_rate_limit=os.getenv("API_GATEWAY_RATE_LIMIT", "100"),
    )

    # Fetch NAT network/subnet from prior Pulumi backend stack outputs (empty on first run).
    try:
        backend_outputs = get_pulumi_stack_outputs(stack_name, IaCModules.BACKEND.value)

        def _output_val(key: str) -> str:
            out = backend_outputs.get(key)
            return out.value if out is not None else ""

        nat_network_id = _output_val("nat_network_id")
        nat_subnet_id = _output_val("nat_subnet_id")
        backend_sa_email = _output_val("backend_sa_email")
    except Exception:
        nat_network_id = ""
        nat_subnet_id = ""
        backend_sa_email = ""

    env_outputs = get_pulumi_stack_outputs(stack_name, IaCModules.ENVIRONMENT.value)
    project = env_outputs["project_id"].value
    location = os.getenv("GCP_REGION", "europe-west1")
    os.environ["DEPLOYMENT_PROJECT_ID"] = project

    # These values are authoritative in the environment stack outputs.
    env_vars_cfg = dataclasses.replace(
        env_vars_cfg,
        frontend_url=env_outputs["frontend_url"].value,
        backend_url=env_outputs["backend_url"].value,
        target_environment_type=env_outputs["environment_type"].value,
    )

    source_dir = os.path.join(repo_dir, "backend")

    cmd, env_vars_file = build_gcloud_deploy_command(
        source_dir=source_dir,
        project=project,
        region=location,
        service_account_email=backend_sa_email,
        network_id=nat_network_id,
        subnet_id=nat_subnet_id,
        cfg=env_vars_cfg,
    )

    print(f"info: running gcloud run deploy --source for {stack_name}")
    try:
        result = subprocess.run(cmd, check=False, text=True, capture_output=True)
        print(result.stdout)
        print(result.stderr)
        if result.returncode != 0:
            raise subprocess.CalledProcessError(result.returncode, cmd)
    finally:
        os.unlink(env_vars_file)


def _deploy_backend(stack_name: str):
    # 1. Build and deploy Cloud Run via gcloud run deploy --source (Cloud Build).
    #    This must run before pulumi up so the Cloud Run service exists for import.
    _gcloud_deploy_backend(stack_name=stack_name)

    # 2. Run pulumi up on the backend (NAT, SA, API Gateway, imports Cloud Run service).
    up_results = run_pulumi_up(stack_name, IaCModules.BACKEND)

    # 3. Run the smoke tests for the backend.
    apigateway_url = up_results.outputs["apigateway_url"].value
    _run_smoke_tests(f"{apigateway_url}/api/version")


def _deploy_common(stack_name: str):
    # 1. run pulumi up on common
    run_pulumi_up(stack_name, IaCModules.COMMON)

    # 2. run smoke tests
    environment_outputs = get_pulumi_stack_outputs(stack_name, IaCModules.ENVIRONMENT.value)

    # 2.1 run smoke tests for the backend
    backend_url = environment_outputs["backend_url"].value
    _run_smoke_tests(f"{backend_url}/version", 30)

    # 2.2 run smoke tests for the frontend
    frontend_url = environment_outputs["frontend_url"].value
    _run_smoke_tests(f"{frontend_url}/data/version.json", 30)


def _tag_the_environment_with_deployment_info(stack_name: str):
    print(f"Tagging the environment: {stack_name} with the deployment info.")

    stack_path = os.path.join(iac_dir, IaCModules.ENVIRONMENT.value)
    environment_stack = auto.select_stack(
        work_dir=stack_path,
        stack_name=stack_name
    )

    prepare_time = getenv("PREPARE_TIME")
    environment_stack.set_tag("prepare_time", prepare_time)

    env_vars_secret_path = getenv("ENV_VARS_SECRETS_PATH")
    environment_stack.set_tag("env_vars_secrets_path", env_vars_secret_path)

    stack_config_secret_path = getenv("STACK_CONFIG_SECRET_PATH")
    environment_stack.set_tag("stack_config_secret_path", stack_config_secret_path)

    target_git_branch = getenv("TARGET_GIT_BRANCH_NAME")
    environment_stack.set_tag("target_git_branch", target_git_branch)

    target_git_sha = getenv("TARGET_GIT_SHA")
    environment_stack.set_tag("target_git_sha", target_git_sha)

    environment_stack.set_tag("deployment_end_time", datetime.datetime.now(tz=datetime.timezone.utc).isoformat())


def _deploy_environment(stack_name: str):
    """
    Deploy the environment:
    """
    # load the environment variables of the stack.
    load_dot_realm_env(stack_name)
    try:
        print(f"Deploying environment: {stack_name}")

        # 1. run pulumi up for the micro stacks.
        run_pulumi_up(stack_name, IaCModules.ENVIRONMENT)

        # 1.1 Deploy the dns
        run_pulumi_up(stack_name, IaCModules.DNS)

        # 1.2 Deploy the frontend.
        _deploy_frontend(stack_name)

        # 1.3 Deploy the backend.
        _deploy_backend(stack_name)

        # 1.4 Deploy the common
        _deploy_common(stack_name)

        # 1.5 set the necessary tags to the pulumi environment, necessary for the deployment report.
        _tag_the_environment_with_deployment_info(stack_name)

    except Exception as e:
        print(f"Error deploying the environment: {stack_name}")
        raise e
    finally:
        # clean up the environment variables.
        clear_dot_env(stack_name)


def _main(*, realm_name: str, env_name: str, env_type: EnvironmentTypes):
    # Get the environments that match the selection criteria.
    targeted_environments: list[Environment] = find_environments(realm_name=realm_name,
                                                                 environment_name=env_name,
                                                                 environment_type=env_type)

    if len(targeted_environments) == 0:
        print(f"error: No environments found to deploy for the given selection criteria "
              f"environment_name: {env_name}, environment_type: {env_type} "
              f"in realm: {realm_name}")
        exit(1)

    for environment in targeted_environments:
        _deploy_environment(environment.stack_name)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Deploy the given stack(s) using pulumi commands."
    )

    # Add the arguments to select multiple environments
    add_select_environments_arguments(parser=parser)
    args = parser.parse_args()
    _main(realm_name=args.realm_name, env_name=args.env_name, env_type=args.env_type)
