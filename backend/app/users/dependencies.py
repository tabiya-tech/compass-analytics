import asyncio
import logging

from app.server_dependencies.db_dependencies import AnalyticsDBProvider
from app.users.repository import MongoUserRepository
from app.users.service import IUserService, UserService

logger = logging.getLogger(__name__)

_lock = asyncio.Lock()
_singleton: IUserService | None = None


async def get_user_service() -> IUserService:
    global _singleton
    if _singleton is None:
        async with _lock:
            if _singleton is None:
                db = await AnalyticsDBProvider.get_db()
                _singleton = UserService(repository=MongoUserRepository(db))
    return _singleton


def clear_user_service_cache() -> None:
    """Test-only: reset the singleton so the next request gets a fresh instance."""
    global _singleton
    _singleton = None
