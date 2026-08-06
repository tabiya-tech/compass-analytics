import asyncio
import logging

from app.analytics.reach.repository import CompassReachRepository
from app.analytics.reach.service import IReachService, ReachService
from app.app_config import get_application_config
from app.auth.api_key import ApiKeyAuth, ExternalService
from app.users.dependencies import get_user_service
from common_libs.http_client.base import AsyncHttpClient

logger = logging.getLogger(__name__)

_lock = asyncio.Lock()
_service_singleton: IReachService | None = None
_http_client: AsyncHttpClient | None = None


async def get_reach_service() -> IReachService:
    global _service_singleton, _http_client
    if _service_singleton is None:
        async with _lock:
            if _service_singleton is None:
                config = get_application_config()
                # Route the outbound Compass key through ApiKeyAuth's registry
                # rather than reaching into the raw config dict.
                api_keys = ApiKeyAuth(config.service_api_keys)
                _http_client = AsyncHttpClient(
                    base_url=config.compass_base_url,
                    headers={"X-API-Key": api_keys.key_for(ExternalService.COMPASS)},
                )
                user_service = await get_user_service()
                _service_singleton = ReachService(
                    repository=CompassReachRepository(_http_client),
                    user_service=user_service,
                )
    return _service_singleton


async def close_reach_service() -> None:
    """Close the outbound HTTP client and reset the singleton (called on shutdown)."""
    global _service_singleton, _http_client
    if _http_client is not None:
        await _http_client.close()
        _http_client = None
    _service_singleton = None


def clear_reach_service_cache() -> None:
    """Test-only: reset the singleton so the next request gets a fresh instance."""
    global _service_singleton, _http_client
    _service_singleton = None
    _http_client = None
