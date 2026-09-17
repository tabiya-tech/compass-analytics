"""
Export the backend's OpenAPI schema to a JSON file, for the frontend's
`openapi-typescript` codegen to read.

Usage (from backend/):
    poetry run python -m scripts.export_openapi [--output build/openapi.json]
"""

import argparse
import json
import os
from pathlib import Path

# Importing app.server (below) reads these immediately, since it builds its module-level `app`
# at import time — this happens locally with no .env, and in CI's build-openapi-spec job, which
# has no real secrets either. Schema generation never touches a live DB/Firebase, so the real
# values don't matter, only that every var server.py requires is set. If server.py adds a new
# required var, add a dummy value for it here too.
_DUMMY_ENV = {
    "FRONTEND_URL": "http://localhost:5173",
    "BACKEND_URL": "http://localhost:8080",
    "TARGET_ENVIRONMENT_TYPE": "local",
    "TARGET_ENVIRONMENT_NAME": "local",
    "BACKEND_ENABLE_SENTRY": "False",
    "ANALYTICS_MONGODB_URI": "mongodb://localhost:27017",
    "ANALYTICS_DATABASE_NAME": "compass-analytics-schema-export",
    "COMPASS_API_KEY": "schema-export-dummy-key",
    "COMPASS_BASE_URL": "http://localhost:9999",
}


def _set_dummy_env() -> None:
    for key, value in _DUMMY_ENV.items():
        os.environ.setdefault(key, value)


def export_openapi_schema(output_path: Path) -> None:
    _set_dummy_env()
    from app.server import app  # pylint: disable=import-outside-toplevel

    schema = app.openapi()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(schema, indent=2) + "\n")
    print(f"Wrote OpenAPI schema to {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("build/openapi.json"),
        help="Where to write the schema (relative to backend/). Default: build/openapi.json",
    )
    args = parser.parse_args()
    export_openapi_schema(args.output)


if __name__ == "__main__":
    main()
