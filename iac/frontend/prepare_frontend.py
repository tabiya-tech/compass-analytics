import datetime
import json
import os
import shutil
import subprocess
import sys

# Determine the absolute path to the 'iac' directory
iac_folder = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
repo_dir = os.path.abspath(os.path.join(iac_folder, '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from within the iac/frontend directory.
sys.path.insert(0, iac_folder)

from lib import getenv

# Where the Vite build outputs
_frontend_src_dir = os.path.join(repo_dir, "frontend")
_frontend_dist_dir = os.path.join(_frontend_src_dir, "dist")

# Staging area — each stack deployment gets its own copy so concurrent deploys don't clash
deployments_dir = os.path.join(iac_folder, "frontend", "_tmp", "deployments")


def _build_frontend(*, stack_name: str, dot_env_path: str) -> None:
    """
    Run `yarn build` inside the frontend/ directory, with VITE_* env vars loaded from
    the stack's .env file baked into the JS bundle at compile time.
    """
    print(f"info: building frontend for {stack_name} using env from {dot_env_path}")

    # Start from the current process environment (so PATH, HOME, etc. are available)
    build_env = os.environ.copy()

    # Layer in the VITE_* vars from the deployment's .env file
    if os.path.exists(dot_env_path):
        with open(dot_env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                build_env[key.strip()] = value.strip()

    subprocess.run(
        ["yarn", "build"],
        cwd=_frontend_src_dir,
        env=build_env,
        check=True,
        text=True,
    )
    print("info: frontend build complete.")


def _write_version_json(staging_dir: str) -> None:
    """
    Write data/version.json into the staging directory, replacing the ###placeholder### tokens
    that Vite copied verbatim from public/data/version.json.
    """
    version_json_path = os.path.join(staging_dir, "data", "version.json")
    version = {
        "date": datetime.datetime.now(tz=datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S.000 UTC"),
        "branch": getenv("TARGET_GIT_BRANCH_NAME"),
        "buildNumber": getenv("DEPLOYMENT_RUN_NUMBER"),
        "sha": getenv("TARGET_GIT_SHA"),
    }
    os.makedirs(os.path.dirname(version_json_path), exist_ok=True)
    with open(version_json_path, "w", encoding="utf-8") as f:
        json.dump(version, f, indent=2)
    print(f"info: version.json written: {version}")


def prepare_frontend(*, stack_name: str) -> str:
    """
    Build the frontend at deploy time (VITE_* vars baked into the bundle) and copy
    the output into a per-stack staging directory that deploy_frontend.py uploads to GCS.

    Returns the absolute path to the per-stack staging directory.
    """
    # The .env file for this stack was written by scripts/prepare.py
    dot_env_path = os.path.join(iac_folder, f".env.{stack_name}")

    _build_frontend(stack_name=stack_name, dot_env_path=dot_env_path)

    # Copy the Vite dist/ output into a per-stack staging directory
    stack_staging_dir = os.path.join(deployments_dir, stack_name)
    if os.path.exists(stack_staging_dir):
        shutil.rmtree(stack_staging_dir)
    shutil.copytree(_frontend_dist_dir, stack_staging_dir)

    # Stamp the real build metadata into data/version.json (Vite copies the
    # public/data/version.json template verbatim; we fill it in here).
    _write_version_json(stack_staging_dir)

    print(f"info: frontend staged at {stack_staging_dir}")
    return stack_staging_dir
