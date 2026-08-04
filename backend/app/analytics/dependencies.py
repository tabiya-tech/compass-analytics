import asyncio
import logging

from app.analytics.repositories import StubAnalyticsRepository
from app.analytics.services import AnalyticsService, IAnalyticsService

logger = logging.getLogger(__name__)

_lock = asyncio.Lock()
_singleton: IAnalyticsService | None = None


async def get_analytics_service() -> IAnalyticsService:
    global _singleton
    if _singleton is None:
        async with _lock:
            if _singleton is None:
                _singleton = AnalyticsService(repository=StubAnalyticsRepository())
    return _singleton


def clear_analytics_service_cache() -> None:
    """Test-only: reset the singleton so the next request gets a fresh instance."""
    global _singleton
    _singleton = None
