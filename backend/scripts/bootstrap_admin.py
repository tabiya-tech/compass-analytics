"""
Bootstrap admin access for one or more users.

Grants every subject × action combination scoped to ALL_INSTITUTIONS ("*") for
each user ID listed in ADMIN_USER_IDS. Safe to run repeatedly — each grant is
upserted, so re-running does not create duplicates.

Required env vars (loaded from .env if present):
    ANALYTICS_MONGODB_URI       MongoDB connection string
    ANALYTICS_DATABASE_NAME     Database name
    ADMIN_USER_IDS              Comma-separated Firebase sub claims, e.g.
                                "uid1,uid2"

Usage (from backend/):
    ADMIN_USER_IDS=uid1,uid2 poetry run python -m scripts.bootstrap_admin
"""
import asyncio
import logging
import os

from dotenv import load_dotenv

from app.grants.repository import MongoGrantRepository
from app.server_dependencies.db_dependencies import AnalyticsDBProvider
from app.users.types import ALL_INSTITUTIONS, Action, Subject

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bootstrap_admin")

_ALL_GRANTS: list[tuple[Subject, Action]] = [
    (subject, action)
    for subject in Subject
    for action in Action
]


async def _bootstrap() -> None:
    load_dotenv()

    raw = os.getenv("ADMIN_USER_IDS", "").strip()
    if not raw:
        raise SystemExit("ADMIN_USER_IDS is not set or empty.")

    user_ids = [uid.strip() for uid in raw.split(",") if uid.strip()]

    db = await AnalyticsDBProvider.get_db()
    await AnalyticsDBProvider.initialize_mongo_db(db)
    repo = MongoGrantRepository(db)

    for user_id in user_ids:
        for subject, action in _ALL_GRANTS:
            await repo.create(
                user_id=user_id,
                subject=subject,
                action=action,
                institution_id=ALL_INSTITUTIONS,
                granted_by=None,
            )
            logger.info("Granted %s:%s @ * → %s", subject.value, action.value, user_id)

    logger.info("Done. Bootstrapped %d user(s).", len(user_ids))
    AnalyticsDBProvider.clear_cache()


if __name__ == "__main__":
    asyncio.run(_bootstrap())
