import asyncio
import logging
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from common_libs.database.get_mongo_db_connection import get_mongo_db_connection
from common_libs.environment_settings.mongo_db_settings import MongoDbSettings
from app.users.repository import USERS_COLLECTION

logger = logging.getLogger(__name__)


async def _check_mongo_health(db: AsyncIOMotorDatabase) -> None:
    server_info = await db.client.server_info()
    logger.info(
        "Connected to MongoDB %s at %s",
        server_info.get("version"),
        db.client.address,
    )


class AnalyticsDBProvider:
    """
    Lazily-initialized, process-wide singleton for the analytics database
    connection. Double-checked locking makes concurrent first-callers safe
    without holding the lock on every subsequent call.
    """

    _db: Optional[AsyncIOMotorDatabase] = None
    _lock = asyncio.Lock()

    @classmethod
    def _get_settings(cls) -> MongoDbSettings:
        # Instantiated lazily (not at import time) so importing this module
        # doesn't require env vars to already be set.
        return MongoDbSettings()

    @classmethod
    async def get_db(cls) -> AsyncIOMotorDatabase:
        if cls._db is not None:
            return cls._db
        async with cls._lock:
            if cls._db is None:
                settings = cls._get_settings()
                db = get_mongo_db_connection(settings.analytics_mongodb_uri, settings.analytics_database_name)
                await _check_mongo_health(db)
                cls._db = db
        return cls._db

    @staticmethod
    async def initialize_mongo_db(db: AsyncIOMotorDatabase) -> None:
        """Create indexes here as collections are added. Idempotent — safe to call on every startup."""
        await db[USERS_COLLECTION].create_index("user_id", unique=True, name="user_id_unique")

    @classmethod
    def clear_cache(cls) -> None:
        """Test-only: forces the next get_db() call to reconnect."""
        cls._db = None
