import asyncio
import logging

from app.roles.repository import MongoRoleRepository, MongoUserRoleRepository
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
                _singleton = UserService(
                    repository=MongoUserRepository(db),
                    role_repository=MongoRoleRepository(db),
                    user_role_repository=MongoUserRoleRepository(db),
                )
    return _singleton


async def get_role_repository() -> MongoRoleRepository:
    db = await AnalyticsDBProvider.get_db()
    return MongoRoleRepository(db)


async def get_user_role_repository() -> MongoUserRoleRepository:
    db = await AnalyticsDBProvider.get_db()
    return MongoUserRoleRepository(db)
