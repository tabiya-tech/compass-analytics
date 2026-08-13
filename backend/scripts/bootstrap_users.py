"""
Provision users from a CSV file, granting each one the permissions for their role.

CSV format (header row required):
    user_id,role[,institution_id]

    user_id        Firebase sub claim (required)
    role           One of: implementer, funder, institution_admin, super_admin (required)
    institution_id MongoDB institution identifier (optional — defaults to "*" for
                   super_admin and funder; required for implementer and institution_admin)

See scripts/users.example.csv for a template.

Safe to run repeatedly — each grant is upserted, so re-running does not create duplicates.

Required env vars (loaded from .env if present):
    ANALYTICS_MONGODB_URI       MongoDB connection string
    ANALYTICS_DATABASE_NAME     Database name

Usage (from backend/):
    poetry run python -m scripts.bootstrap_users path/to/users.csv
"""
import asyncio
import csv
import logging
import sys
from pathlib import Path

from dotenv import load_dotenv

from app.casbin.adapter import GrantsAdapter
from app.casbin.enforcer import get_enforcer
from app.grants.repository import MongoGrantRepository
from app.grants.roles import ROLES
from app.server_dependencies.db_dependencies import AnalyticsDBProvider
from app.users.types import ALL_INSTITUTIONS

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("bootstrap_users")

_INSTITUTION_OPTIONAL_ROLES = {"super_admin", "funder"}


def _parse_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        if reader.fieldnames is None or "user_id" not in reader.fieldnames or "role" not in reader.fieldnames:
            raise SystemExit(f"CSV must have at least 'user_id' and 'role' columns. Got: {reader.fieldnames}")
        rows = list(reader)
    if not rows:
        raise SystemExit("CSV contains no data rows.")
    return rows


def _validate_rows(rows: list[dict[str, str]]) -> list[tuple[str, str, str]]:
    """Return (user_id, role, institution_id) triples, failing fast on bad input."""
    valid = []
    for i, row in enumerate(rows, start=2):  # row 1 is the header
        user_id = row.get("user_id", "").strip()
        role = row.get("role", "").strip()
        institution_id = row.get("institution_id", "").strip()

        if not user_id:
            raise SystemExit(f"Row {i}: 'user_id' is empty.")
        if role not in ROLES:
            raise SystemExit(f"Row {i}: unknown role '{role}'. Valid roles: {', '.join(sorted(ROLES))}.")
        if not institution_id:
            if role in _INSTITUTION_OPTIONAL_ROLES:
                institution_id = ALL_INSTITUTIONS
            else:
                raise SystemExit(f"Row {i}: 'institution_id' is required for role '{role}'.")

        valid.append((user_id, role, institution_id))
    return valid


async def _provision(entries: list[tuple[str, str, str]]) -> None:
    load_dotenv()
    db = await AnalyticsDBProvider.get_db()
    await AnalyticsDBProvider.initialize_mongo_db(db)
    grant_repo = MongoGrantRepository(db)
    enforcer = await get_enforcer(GrantsAdapter(grant_repo))

    for user_id, role, institution_id in entries:
        for subject, action in ROLES[role]:
            perm = f"{subject.value}:{action.value}"
            await enforcer.add_policy(user_id, institution_id, perm)
        logger.info("%-40s %-20s %s", user_id, role, institution_id)

    AnalyticsDBProvider.clear_cache()
    logger.info("Done. Provisioned %d user(s).", len(entries))


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: poetry run python -m scripts.bootstrap_users <path/to/users.csv>")

    csv_path = Path(sys.argv[1])
    if not csv_path.is_file():
        raise SystemExit(f"File not found: {csv_path}")

    rows = _parse_csv(csv_path)
    entries = _validate_rows(rows)
    asyncio.run(_provision(entries))


if __name__ == "__main__":
    main()
