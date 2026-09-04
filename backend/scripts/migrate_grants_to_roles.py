"""
Migrate users from the old grants-based schema to the new role-based schema.

The old `grants` collection stored one row per (user, subject, action, institution):
    { grant_id, user_id, subject, action, institution_id }
where institution_id="*" meant deployment-wide.

This script infers the best-matching role for each user from the roles in the DB,
then writes user_roles rows for them.

Matching rules:
  - A user's grants cover a role if every (subject, action) in the role's permissions
    appears in their grants, all scoped to the same institution (or all "*").
  - An institution-scoped match requires all grants for the matched permissions to share
    the same non-"*" institution_id.
  - Deployment-wide matches require all relevant grants to have institution_id="*".
  - If a user's grants span multiple institutions, one user_role row is written per institution.
  - Users whose grants match no role are skipped with a warning.

Existing user_role rows are NOT overwritten — assign() is idempotent (upsert on the unique
index), so re-running is safe.

Required env vars (loaded from .env if present):
    ANALYTICS_MONGODB_URI       MongoDB connection string
    ANALYTICS_DATABASE_NAME     Database name

Usage (from backend/):
    # Dry run — shows what would be written, changes nothing
    poetry run python -m scripts.migrate_grants_to_roles --dry-run

    # Live run — writes user_roles
    poetry run python -m scripts.migrate_grants_to_roles

    # Limit to a specific user
    poetry run python -m scripts.migrate_grants_to_roles --user-id <firebase-uid>

    # Process at most N users
    poetry run python -m scripts.migrate_grants_to_roles --limit 5
"""

import argparse
import asyncio
import logging
import sys
from collections import defaultdict
from dataclasses import dataclass

from dotenv import load_dotenv

from app.roles.repository import MongoRoleRepository, MongoUserRoleRepository
from app.roles.types import RoleRecord
from app.server_dependencies.db_dependencies import AnalyticsDBProvider
from app.users.types import Action, Subject

# Canonical role definitions used for matching. Order matters: the first role
# whose permission set is fully covered by the user's grants wins. Most
# permissive roles are listed last so a user with all permissions gets the most
# specific role that fits, not super_admin.
ROLES: dict[str, list[tuple[Subject, Action]]] = {
    # Sees their own institution's dashboard and jobseeker data.
    "implementer": [
        (Subject.DASHBOARD, Action.VIEW),
        (Subject.JOBSEEKERS, Action.VIEW),
        (Subject.ACCOUNT, Action.VIEW),
    ],
    # Sees the cross-institution dashboard and can manage access across the deployment.
    "funder": [
        (Subject.DASHBOARD, Action.VIEW),
        (Subject.INSTITUTIONS, Action.VIEW),
        (Subject.ACCESS_MANAGEMENT, Action.MANAGE),
        (Subject.ACCOUNT, Action.VIEW),
    ],
    # Full visibility and access management scoped to a single institution.
    "institution_admin": [
        (Subject.DASHBOARD, Action.VIEW),
        (Subject.JOBSEEKERS, Action.VIEW),
        (Subject.INSTITUTIONS, Action.VIEW),
        (Subject.ACCESS_MANAGEMENT, Action.MANAGE),
        (Subject.ACCOUNT, Action.VIEW),
    ],
    # Every subject × every action, scoped to all institutions.
    "super_admin": [(subject, action) for subject in Subject for action in Action],
}

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("migrate_grants_to_roles")

GRANTS_COLLECTION = "grants"


@dataclass(frozen=True)
class GrantKey:
    """One (subject, action) pair from a grant row."""
    subject: str
    action: str


@dataclass(frozen=True)
class UserGrant:
    user_id: str
    subject: str
    action: str
    institution_id: str  # "*" = deployment-wide


def _build_required_keys() -> list[tuple[str, frozenset[GrantKey]]]:
    """
    Return (role_name, required_keys) pairs ordered from most to least permissive,
    so the first match for a user's grant set is the most specific role that fits.
    """
    return [
        (name, frozenset(GrantKey(subject=subject.value, action=action.value) for subject, action in perms))
        for name, perms in ROLES.items()
    ]


# Built once at import time.
_ROLE_REQUIREMENTS = _build_required_keys()


def _infer_assignments(
    user_id: str,
    grants: list[UserGrant],
    roles_by_name: dict[str, RoleRecord],
) -> list[tuple[str, str, str | None]]:
    """
    Return (role_id, role_name, institution_id) triples to write for this user.

    Strategy:
      1. Group grants by institution_id. Each institution group is matched
         independently so a user with the implementer role at two institutions
         gets two user_role rows.
      2. Within each institution group, find the first role in ROLES whose
         permission set is fully covered by that group's grants.
      3. A match on institution_id="*" produces institution_id=None (deployment-wide).
    """
    grants_by_institution: dict[str, set[GrantKey]] = defaultdict(set)
    for grant in grants:
        grants_by_institution[grant.institution_id].add(GrantKey(subject=grant.subject, action=grant.action))

    assignments: list[tuple[str, str, str | None]] = []

    for raw_institution_id, held_keys in grants_by_institution.items():
        # When checking institution-specific grants, also consider deployment-wide
        # grants the user holds — they contribute to the effective permission set.
        if raw_institution_id != "*":
            held_keys = held_keys | grants_by_institution.get("*", set())

        matched_name: str | None = None
        for role_name, required_keys in _ROLE_REQUIREMENTS:
            if required_keys.issubset(held_keys):
                matched_name = role_name
                break

        if matched_name is None:
            continue

        role = roles_by_name.get(matched_name)
        if role is None:
            logger.warning(
                "SKIP  user_id=%-40s institution=%-20s — role '%s' matched but is not in the DB",
                user_id,
                raw_institution_id,
                matched_name,
            )
            continue

        institution_id = None if raw_institution_id == "*" else raw_institution_id
        assignments.append((role.id, matched_name, institution_id))

    return assignments


async def _run(dry_run: bool, user_id_filter: str | None, limit: int | None) -> None:
    load_dotenv()
    db = await AnalyticsDBProvider.get_db()
    await AnalyticsDBProvider.initialize_mongo_db(db)

    role_repo = MongoRoleRepository(db)
    user_role_repo = MongoUserRoleRepository(db)
    grants_col = db[GRANTS_COLLECTION]

    all_roles = await role_repo.list_all()
    if not all_roles:
        logger.error("No roles found in the roles collection. Seed roles before migrating.")
        sys.exit(1)
    roles_by_name = {role.name: role for role in all_roles}
    logger.info("Loaded %d role(s) from DB: %s", len(all_roles), ", ".join(roles_by_name))

    # Build the query for the grants collection.
    query: dict = {}
    if user_id_filter:
        query["user_id"] = user_id_filter
        logger.info("Filtering to user_id=%s", user_id_filter)

    # Stream all matching grants and group by user_id.
    grants_by_user: dict[str, list[UserGrant]] = defaultdict(list)
    async for doc in grants_col.find(query):
        grants_by_user[doc["user_id"]].append(
            UserGrant(
                user_id=doc["user_id"],
                subject=doc["subject"],
                action=doc["action"],
                institution_id=doc.get("institution_id", "*"),
            )
        )

    user_ids = sorted(grants_by_user.keys())
    if not user_ids:
        logger.info("No grants found matching the given filter. Nothing to migrate.")
        return

    if limit is not None:
        user_ids = user_ids[:limit]
        logger.info("Processing first %d of %d user(s) (--limit applied).", limit, len(grants_by_user))
    else:
        logger.info("Found %d user(s) with grants.", len(user_ids))

    if dry_run:
        logger.info("DRY RUN — no writes will happen.")

    processed = 0
    skipped = 0

    for uid in user_ids:
        user_grants = grants_by_user[uid]
        assignments = _infer_assignments(uid, user_grants, roles_by_name)

        if not assignments:
            logger.warning(
                "SKIP  user_id=%-40s — %d grant(s) match no role",
                uid,
                len(user_grants),
            )
            skipped += 1
            continue

        for role_id, role_name, institution_id in assignments:
            if dry_run:
                logger.info(
                    "WOULD user_id=%-40s role=%-20s institution=%s",
                    uid,
                    role_name,
                    institution_id or "*",
                )
            else:
                await user_role_repo.assign(
                    user_id=uid,
                    role_id=role_id,
                    institution_id=institution_id,
                    granted_by=None,
                )
                logger.info(
                    "OK    user_id=%-40s role=%-20s institution=%s",
                    uid,
                    role_name,
                    institution_id or "*",
                )

        processed += 1

    logger.info(
        "%s %d user(s): %d written, %d skipped (no matching role).",
        "Would process" if dry_run else "Processed",
        len(user_ids),
        processed,
        skipped,
    )

    AnalyticsDBProvider.clear_cache()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Migrate existing grants to the new role-based schema.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be written without touching the database.",
    )
    parser.add_argument(
        "--user-id",
        metavar="UID",
        help="Only migrate this specific user (Firebase uid).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        metavar="N",
        help="Process at most N users (alphabetical order by user_id).",
    )
    args = parser.parse_args()

    asyncio.run(_run(dry_run=args.dry_run, user_id_filter=args.user_id, limit=args.limit))


if __name__ == "__main__":
    main()
