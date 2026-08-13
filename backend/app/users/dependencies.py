import asyncio
import logging

from app.casbin.adapter import GrantsAdapter
from app.casbin.enforcer import get_enforcer
from app.grants.repository import MongoGrantRepository
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
                grant_repo = MongoGrantRepository(db)
                enforcer = await get_enforcer(GrantsAdapter(grant_repo))
                _singleton = UserService(
                    repository=MongoUserRepository(db),
                    grant_repository=grant_repo,
                    enforcer=enforcer,
                )
    return _singleton


async def get_grant_repository() -> MongoGrantRepository:
    db = await AnalyticsDBProvider.get_db()
    return MongoGrantRepository(db)


