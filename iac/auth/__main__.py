import os
import sys

libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, libs_dir)

import pulumi
from setup_auth import deploy_auth

from lib.std_pulumi import load_dot_realm_env, getenv, getstackref, getconfig, parse_realm_env_name_from_stack


def main():
    _, _, stack_name = parse_realm_env_name_from_stack()
    load_dot_realm_env(stack_name)

    location = getconfig(name="region", config="gcp")

    env_reference = pulumi.StackReference(f"tabiya-tech/analytics-environment/{stack_name}")
    environment_type = getstackref(env_reference, "environment_type")
    project_id = getstackref(env_reference, "project_id")
    frontend_domain = getstackref(env_reference, "frontend_domain")

    gcp_oauth_client_id = getenv("GCP_OAUTH_CLIENT_ID")
    gcp_oauth_client_secret = getenv("GCP_OAUTH_CLIENT_SECRET", secret=True)

    deploy_auth(
        location=location,
        environment_type=environment_type,
        project=project_id,
        frontend_domain=frontend_domain,
        gcp_oauth_client_id=gcp_oauth_client_id,
        gcp_oauth_client_secret=gcp_oauth_client_secret,
    )


if __name__ == "__main__":
    main()
