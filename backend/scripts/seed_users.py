"""
Dev-only helper: seed the `users` collection with sample role/scope records so
GET /api/me and scoped analytics return real data during local end-to-end
testing.

This is NOT part of any deploy or provisioning flow — real users will be
provisioned through a proper admin path later. It only ever touches the database
named by ANALYTICS_MONGODB_URI / ANALYTICS_DATABASE_NAME in your local env, and
it upserts (safe to run repeatedly).

Usage (from backend/):
    poetry run python -m scripts.seed_users

The user_ids below are placeholders — set them to the Firebase `sub` of the
account(s) you log in with locally (decode your dev JWT, or check the network
tab for the token) so /api/me matches the caller.
"""
import asyncio
import logging
from datetime import datetime, timezone

from dotenv import load_dotenv

from app.server_dependencies.db_dependencies import AnalyticsDBProvider
from app.users.repository import USERS_COLLECTION

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_users")

# Edit these user_ids to match the Firebase `sub` claim of your local accounts.
_SEED_USERS = [
    {
        "user_id": "dev-implementer",
        "email": "implementer@example.com",
        "name": "Dev Implementer",
        "role": "implementer",
        "scope_type": "institutions",
        "institution_ids": ["inst-demo-1"],
        "active_modules": ["build-your-profile", "job-readiness", "career-explorer", "jobs"],
    },
    {
        "user_id": "dev-funder",
        "email": "funder@example.com",
        "name": "Dev Funder",
        "role": "funder",
        "scope_type": "all",
        "institution_ids": [],
        "active_modules": ["build-your-profile", "job-readiness", "career-explorer", "jobs"],
    },
]


async def _seed() -> None:
    load_dotenv()
    db = await AnalyticsDBProvider.get_db()
    await AnalyticsDBProvider.initialize_mongo_db(db)

    for user in _SEED_USERS:
        doc = {**user, "created_at": datetime.now(timezone.utc)}
        await db[USERS_COLLECTION].update_one(
            {"user_id": user["user_id"]},
            {"$set": doc},
            upsert=True,
        )
        logger.info("Seeded %s (%s)", user["user_id"], user["role"])

    logger.info("Done. Seeded %d user(s) into the '%s' collection.", len(_SEED_USERS), USERS_COLLECTION)
    AnalyticsDBProvider.clear_cache()


if __name__ == "__main__":
    asyncio.run(_seed())
