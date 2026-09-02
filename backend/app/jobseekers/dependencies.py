import asyncio
import logging

from app.app_config import get_application_config
from app.auth.api_key import ExternalService
from app.jobseekers.repositories import CompassStudentsRepository
from app.jobseekers.services import IJobseekersService, JobseekersService
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
                http_client = AsyncHttpClient(
                    base_url=config.compass_base_url,
                    headers={"X-API-Key": api_key},
                )
                _singleton = JobseekersService(repository=CompassStudentsRepository(http_client))
    return _singleton


def clear_jobseekers_service_cache() -> None:
    """Test-only: reset the singleton so the next request gets a fresh instance."""
    global _singleton
    _singleton = None
