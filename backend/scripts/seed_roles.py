"""
Seed the canonical role documents into the `roles` collection.

Roles are defined here in the same way as the migration script so the two
stay in sync. Running this script multiple times is safe — each role is
upserted on its unique `name` field, so no duplicates are created.

Required env vars (loaded from .env if present):
    ANALYTICS_MONGODB_URI       MongoDB connection string
    ANALYTICS_DATABASE_NAME     Database name

Usage (from backend/):
    # Dry run — shows what would be inserted, changes nothing
    poetry run python -m scripts.seed_roles --dry-run

    # Live run — upserts roles into the DB
    poetry run python -m scripts.seed_roles
"""

import argparse
import asyncio
import logging
from datetime import datetime, timezone

from dotenv import load_dotenv

from app.server_dependencies.db_dependencies import AnalyticsDBProvider
from app.users.types import Action, Subject

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("seed_roles")

# Canonical role definitions. Must stay in sync with migrate_grants_to_roles.py.
ROLE_DEFINITIONS: list[dict] = [
    {
        "name": "implementer",
        "label": "Implementer",
        "description": "Sees their own institution's dashboard and jobseeker data.",
        "assignable": True,
        "permissions": [
            {"subject": Subject.DASHBOARD.value, "action": Action.VIEW.value},
            {"subject": Subject.JOBSEEKERS.value, "action": Action.VIEW.value},
            {"subject": Subject.ACCOUNT.value, "action": Action.VIEW.value},
        ],
    },
    {
        "name": "funder",
        "label": "Funder",
        "description": "Sees the cross-institution dashboard and can manage access across the deployment.",
        "assignable": True,
        "permissions": [
            {"subject": Subject.DASHBOARD.value, "action": Action.VIEW.value},
            {"subject": Subject.INSTITUTIONS.value, "action": Action.VIEW.value},
            {"subject": Subject.ACCESS_MANAGEMENT.value, "action": Action.MANAGE.value},
            {"subject": Subject.ACCOUNT.value, "action": Action.VIEW.value},
        ],
    },
    {
        "name": "institution_admin",
        "label": "Institution Admin",
        "description": "Full visibility and access management scoped to a single institution.",
        "assignable": True,
        "permissions": [
            {"subject": Subject.DASHBOARD.value, "action": Action.VIEW.value},
            {"subject": Subject.JOBSEEKERS.value, "action": Action.VIEW.value},
            {"subject": Subject.INSTITUTIONS.value, "action": Action.VIEW.value},
            {"subject": Subject.ACCESS_MANAGEMENT.value, "action": Action.MANAGE.value},
            {"subject": Subject.ACCOUNT.value, "action": Action.VIEW.value},
        ],
    },
    {
        "name": "super_admin",
        "label": "Super Admin",
        "description": "Every subject × every action, scoped to all institutions.",
        "assignable": False,
        "permissions": [
            {"subject": subject.value, "action": action.value}
            for subject in Subject
            for action in Action
        ],
    },
]


async def _run(dry_run: bool) -> None:
    load_dotenv()
    db = await AnalyticsDBProvider.get_db()
    await AnalyticsDBProvider.initialize_mongo_db(db)

    roles_col = db["roles"]
    now = datetime.now(timezone.utc)

    for role_def in ROLE_DEFINITIONS:
        name = role_def["name"]
        doc = {**role_def, "created_at": now, "created_by": None}

        if dry_run:
            logger.info("WOULD upsert role: %s (%s)", name, role_def["label"])
            continue

        result = await roles_col.update_one(
            {"name": name},
            {"$setOnInsert": doc},
            upsert=True,
        )
        if result.upserted_id:
            logger.info("INSERTED role: %s (%s)", name, role_def["label"])
        else:
            logger.info("EXISTS  role: %s (%s) — skipped (use $set to overwrite)", name, role_def["label"])

    AnalyticsDBProvider.clear_cache()

    if dry_run:
        logger.info("DRY RUN complete — %d role(s) would be upserted.", len(ROLE_DEFINITIONS))
    else:
        logger.info("Done. %d role(s) processed.", len(ROLE_DEFINITIONS))


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed canonical roles into the roles collection.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be inserted without touching the database.",
    )
    args = parser.parse_args()
    asyncio.run(_run(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
