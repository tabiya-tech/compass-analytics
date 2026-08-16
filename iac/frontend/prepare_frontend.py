import os

import sys
import shutil
import subprocess

# Determine the absolute path to the 'iac' directory
iac_folder = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/frontend directory.
sys.path.insert(0, iac_folder)

from lib import getenv, get_realm_and_env_name_from_stack, \
    get_pulumi_stack_outputs, construct_artifacts_dir, \
    download_generic_artifacts_file, Version

from scripts.formatters import construct_artifacts_version

# The actual frontend build artifact filename is specified in the iac/scripts/build-and-upload-fe.sh script.
frontend_build_artifact_filename = "frontend-build.tar.gz"

# the constant directories.
current_dir = os.path.join(iac_folder, "frontend")
base_artifacts_dir = os.path.join(current_dir, "_tmp", "artifacts")
deployments_dir = os.path.join(current_dir, "_tmp", "deployments")


def download_frontend_bundle(
        *,
        realm_name: str,
        deployment_number: str,
        artifacts_version: Version) -> None:
    """
    Download the frontend build bundle given the frontend artifact version.

    Args:
        :param realm_name:
        :param deployment_number:
        :param artifacts_version:  The version of the frontend build bundle.
    """
    # 1. get the directory where to save the frontend build bundle.
    frontend_artifacts_version = construct_artifacts_version(
        git_branch_name=artifacts_version.git_branch_name,
        git_sha=artifacts_version.git_sha
    )

    artifacts_dir = construct_artifacts_dir(
        deployment_number=deployment_number,
        fully_qualified_version=frontend_artifacts_version)
    # artifacts dir, the folder to store the frontend build bundle.
    artifacts_destination_dir = os.path.join(base_artifacts_dir, artifacts_dir)
    os.makedirs(artifacts_destination_dir, exist_ok=False)

    # 2. Get the generic repository to download the frontend build bundle.
    realm_outputs = get_pulumi_stack_outputs(stack_name=realm_name, module="realm")

    # the generic repository name is defined in iac/realm/create_realm:_create_repositories method body
    # if it is not there python will raise `KeyError`, a good thing.
    realm_generic_repository = realm_outputs["generic_repository"].value

    print(f"Downloading the frontend build bundle... to {artifacts_destination_dir}")

    try:
        # 3. Download the frontend build bundle.
        download_generic_artifacts_file(
            repository=realm_generic_repository,
            version=frontend_artifacts_version,
            file_name=frontend_build_artifact_filename,
            output_dir=artifacts_destination_dir
        )

        # 4. extract the downloaded frontend build bundle.
        subprocess.run(
            [
                "tar",
                "-xf",
                frontend_build_artifact_filename,
            ],
            cwd=artifacts_destination_dir,
            check=True,
            text=True
        )

        # clean up: remove the downloaded frontend build bundle.
        os.remove(os.path.join(artifacts_destination_dir, frontend_build_artifact_filename))

        print("Done downloading the frontend build bundle.")
    except subprocess.CalledProcessError as e:
        print(f"Error downloading frontend bundle: {e}")
        raise


def prepare_frontend(
        *,
        stack_name: str):
    """
    Prepare the frontend for deployment.
     1. Ensures that the artifact is downloaded, otherwise downloads it.
     2. Copies the downloaded artifact to the stack artifacts dir.

    The analytics frontend is a static Vite build that reads all of its
    configuration at build time (import.meta.env.VITE_*) and its branding at
    runtime from /branding.json. There is no runtime env.js / window config to
    inject, so the preparation step is limited to fetching and extracting the
    build bundle.
    """

    # Get the path to the frontend build bundle
    # This is specific to the deployment, and the stack name.
    deployment_number = getenv("DEPLOYMENT_RUN_NUMBER")
    artifacts_version = Version(
        git_branch_name=getenv("TARGET_GIT_BRANCH_NAME"),
        git_sha=getenv("TARGET_GIT_SHA")
    )

    generic_artifact_version = construct_artifacts_version(
        git_branch_name=artifacts_version.git_branch_name,
        git_sha=artifacts_version.git_sha
    )

    artifacts_dir = construct_artifacts_dir(
        deployment_number=deployment_number,
        fully_qualified_version=generic_artifact_version)

    # artifacts dir, the folder to store the frontend build bundle.
    artifacts_dir = os.path.join(base_artifacts_dir, artifacts_dir)

    realm_name, _ = get_realm_and_env_name_from_stack(stack_name)

    # get the required environment variables, for the frontend.
    print(f"preparing frontend for the run: {artifacts_dir}-{stack_name}...")

    # If the path (artifacts dir) already exists, skip, otherwise create it and download the frontend build bundle.
    # This should be the same folder for if the frontend deployments are on the same run.
    if not os.path.exists(artifacts_dir):
        # download the frontend build bundle.
        download_frontend_bundle(
            realm_name=realm_name,
            deployment_number=deployment_number,
            artifacts_version=artifacts_version)

    # Have a copy of the artifacts for this deployment (the separate stack name),
    # so that changes specific to the environment can be made without affecting other stacks.
    stack_artifacts_dir = construct_artifacts_dir(
        deployment_number=deployment_number,
        fully_qualified_version=generic_artifact_version,
        stack_name=stack_name)

    # copy the artifacts to the stack artifacts dir.
    stack_artifacts_dir = os.path.join(deployments_dir, stack_artifacts_dir)
    shutil.copytree(artifacts_dir, stack_artifacts_dir, dirs_exist_ok=True)

    print(f"Done preparing frontend for the run: {artifacts_dir}-{stack_name}.")
