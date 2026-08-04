import asyncio
import logging

from app.analytics.repositories import CompassAnalyticsRepository
from app.analytics.services import AnalyticsService, IAnalyticsService
from app.app_config import get_application_config
from app.auth.api_key import ExternalService
from common_libs.http_client.base import AsyncHttpClient

logger = logging.getLogger(__name__)

_lock = asyncio.Lock()
_singleton: IAnalyticsService | None = None


async def get_analytics_service() -> IAnalyticsService:
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
                _singleton = AnalyticsService(repository=CompassAnalyticsRepository(http_client))
    return _singleton


def clear_analytics_service_cache() -> None:
    """Test-only: reset the singleton so the next request gets a fresh instance."""
    global _singleton
    _singleton = None
