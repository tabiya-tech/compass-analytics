import asyncio
import logging

from app.analytics.modules.repository import CompassModulesRepository
from app.analytics.modules.service import IModulesService, ModulesService
from app.analytics.reach.repository import CompassReachRepository
from app.analytics.reach.service import IReachService, ReachService
from app.app_config import get_application_config
from app.auth.api_key import ApiKeyAuth, ExternalService
from app.users.dependencies import get_user_service
from common_libs.http_client.base import AsyncHttpClient

logger = logging.getLogger(__name__)


def _build_compass_http_client() -> AsyncHttpClient:
    config = get_application_config()
    # Route the outbound Compass key through ApiKeyAuth's registry rather than reaching into
    # the raw config dict.
    api_keys = ApiKeyAuth(config.service_api_keys)
    return AsyncHttpClient(
        base_url=config.compass_base_url,
        headers={"X-API-Key": api_keys.key_for(ExternalService.COMPASS)},
    )


_lock = asyncio.Lock()
_service_singleton: IReachService | None = None
_http_client: AsyncHttpClient | None = None


async def get_reach_service() -> IReachService:
    global _service_singleton, _http_client
    if _service_singleton is None:
        async with _lock:
            if _service_singleton is None:
                _http_client = _build_compass_http_client()
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


_modules_lock = asyncio.Lock()
_modules_service_singleton: IModulesService | None = None
_modules_http_client: AsyncHttpClient | None = None


async def get_modules_service() -> IModulesService:
    global _modules_service_singleton, _modules_http_client
    if _modules_service_singleton is None:
        async with _modules_lock:
            if _modules_service_singleton is None:
                _modules_http_client = _build_compass_http_client()
                user_service = await get_user_service()
                _modules_service_singleton = ModulesService(
                    repository=CompassModulesRepository(_modules_http_client),
                    user_service=user_service,
                )
    return _modules_service_singleton


async def close_modules_service() -> None:
    """Close the outbound HTTP client and reset the singleton (called on shutdown)."""
    global _modules_service_singleton, _modules_http_client
    if _modules_http_client is not None:
        await _modules_http_client.close()
        _modules_http_client = None
    _modules_service_singleton = None


