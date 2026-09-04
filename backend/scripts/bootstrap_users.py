"""
Provision users from a CSV file, assigning each one a role.

CSV format (header row required):
    user_id,role_name[,institution_id]

    user_id        Firebase sub claim (required)
    role_name      Must match the `name` field of a role document in the DB (required)
    institution_id MongoDB institution identifier (optional — defaults to null for
                   deployment-wide roles; required for institution-scoped roles)

Safe to run repeatedly — each assignment is upserted, so re-running does not create duplicates.

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

from app.roles.repository import MongoRoleRepository, MongoUserRoleRepository
from app.server_dependencies.db_dependencies import AnalyticsDBProvider

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("bootstrap_users")


def _parse_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        if reader.fieldnames is None or "user_id" not in reader.fieldnames or "role_name" not in reader.fieldnames:
            raise SystemExit(f"CSV must have at least 'user_id' and 'role_name' columns. Got: {reader.fieldnames}")
        rows = list(reader)
    if not rows:
        raise SystemExit("CSV contains no data rows.")
    return rows


def _validate_rows(rows: list[dict[str, str]], known_role_names: set[str]) -> list[tuple[str, str, str | None]]:
    """Return (user_id, role_name, institution_id) triples, failing fast on bad input."""
    valid = []
    for i, row in enumerate(rows, start=2):
        user_id = row.get("user_id", "").strip()
        role_name = row.get("role_name", "").strip()
        institution_id = row.get("institution_id", "").strip() or None

        if not user_id:
            raise SystemExit(f"Row {i}: 'user_id' is empty.")
        if role_name not in known_role_names:
            raise SystemExit(f"Row {i}: unknown role_name '{role_name}'. Valid roles: {', '.join(sorted(known_role_names))}.")

        valid.append((user_id, role_name, institution_id))
    return valid


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: poetry run python -m scripts.bootstrap_users <path/to/users.csv>")

    csv_path = Path(sys.argv[1])
    if not csv_path.is_file():
        raise SystemExit(f"File not found: {csv_path}")

    rows = _parse_csv(csv_path)

    async def _run():
        load_dotenv()
        db = await AnalyticsDBProvider.get_db()
        await AnalyticsDBProvider.initialize_mongo_db(db)
        role_repo = MongoRoleRepository(db)
        user_role_repo = MongoUserRoleRepository(db)

        all_roles = await role_repo.list_all()
        role_id_by_name = {r.name: r.id for r in all_roles}
        known_names = set(role_id_by_name)

        entries = _validate_rows(rows, known_names)

        for user_id, role_name, institution_id in entries:
            role_id = role_id_by_name[role_name]
            await user_role_repo.assign(user_id=user_id, role_id=role_id, institution_id=institution_id, granted_by=None)
            logger.info("%-40s %-20s %s", user_id, role_name, institution_id or "*")

        AnalyticsDBProvider.clear_cache()
        logger.info("Done. Provisioned %d user(s).", len(entries))

    asyncio.run(_run())


if __name__ == "__main__":
    main()
