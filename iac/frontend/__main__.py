import os
import sys
import pulumi


# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from within the iac/frontend directory.
sys.path.insert(0, libs_dir)

from deploy_frontend import deploy_frontend
from lib import getconfig, parse_realm_env_name_from_stack, getstackref, load_dot_realm_env, getenv, Version
from lib.std_pulumi import get_labels
from frontend.prepare_frontend import deployments_dir


def main():
    realm_name, environment_name, stack_name = parse_realm_env_name_from_stack()

    # Load environment variables
    load_dot_realm_env(stack_name)

    # Get the config values
    location = getconfig("region", "gcp")
    pulumi.info(f'Using location:{location}')

    # get stack reference
    env_reference = pulumi.StackReference(f"tabiya-tech/analytics-environment/{stack_name}")
    project = getstackref(env_reference, "project_id")

    # The frontend was already built by scripts/up.py (prepare_frontend) before pulumi up runs.
    # Point at the per-stack staging directory that prepare_frontend copied the dist/ into.
    stack_staging_dir = os.path.join(deployments_dir, stack_name)

    labels = get_labels(realm_name=realm_name, environment_name=environment_name)

    # Deploy the frontend
    deploy_frontend(
        project=project,
        location=location,
        artifacts_dir=stack_staging_dir,
        labels=labels,
    )


if __name__ == "__main__":
    main()
