import asyncio
import logging

from app.app_config import get_application_config
from app.auth.api_key import ExternalService
from app.grants.repository import MongoGrantRepository
from app.jobseekers.access import GrantsAccessResolver, IJobseekerAccessResolver
from app.jobseekers.repositories import CompassStudentsRepository
from app.jobseekers.services import IJobseekersService, JobseekersService
from app.server_dependencies.db_dependencies import AnalyticsDBProvider
from common_libs.http_client.base import AsyncHttpClient

logger = logging.getLogger(__name__)

_lock = asyncio.Lock()
_singleton: IJobseekersService | None = None


async def get_jobseekers_service() -> IJobseekersService:
    global _singleton
    if _singleton is None:
        async with _lock:
            if _singleton is None:
                config = get_application_config()
                api_key = config.service_api_keys[ExternalService.COMPASS]
                # `/students/analytics` is a server-to-server endpoint: this API key is what
                # authenticates the call, and Compass scopes nothing on its own — the roster's
                # privacy boundary is enforced here, from the caller's grants.
                http_client = AsyncHttpClient(
                    base_url=config.compass_base_url,
                    headers={"X-API-Key": api_key},
                )
                _singleton = JobseekersService(repository=CompassStudentsRepository(http_client))
    return _singleton


async def get_jobseeker_access_resolver() -> IJobseekerAccessResolver:
    # Per-request, like app.users.dependencies.get_grant_repository: the resolver holds no
    # state worth caching, and a fresh read means a grant revoked a moment ago is honoured.
    db = await AnalyticsDBProvider.get_db()
    return GrantsAccessResolver(MongoGrantRepository(db))


def clear_jobseekers_service_cache() -> None:
    """Test-only: reset the singleton so the next request gets a fresh instance."""
    global _singleton
    _singleton = None
