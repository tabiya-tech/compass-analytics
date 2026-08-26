import asyncio
import logging

from app.analytics.demographics.repository import CompassDemographicsRepository
from app.analytics.demographics.service import DemographicsService, IDemographicsService
from app.analytics.institutions.repository import CompassInstitutionsRepository
from app.analytics.institutions.service import IInstitutionsService, InstitutionsService
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
    api_keys = ApiKeyAuth(config.service_api_keys)
    return AsyncHttpClient(
        base_url=config.compass_base_url,
        headers={"X-API-Key": api_keys.key_for(ExternalService.COMPASS)},
    )


_lock = asyncio.Lock()

_reach_service_singleton: IReachService | None = None
_reach_http_client: AsyncHttpClient | None = None

_institutions_service_singleton: IInstitutionsService | None = None
_institutions_http_client: AsyncHttpClient | None = None


async def get_reach_service() -> IReachService:
    global _reach_service_singleton, _reach_http_client
    if _reach_service_singleton is None:
        async with _lock:
            if _reach_service_singleton is None:
                _reach_http_client = _build_compass_http_client()
                user_service = await get_user_service()
                _reach_service_singleton = ReachService(
                    repository=CompassReachRepository(_reach_http_client),
                    user_service=user_service,
                )
    return _reach_service_singleton


async def close_reach_service() -> None:
    """Close the outbound HTTP client and reset the singleton (called on shutdown)."""
    global _reach_service_singleton, _reach_http_client
    if _reach_http_client is not None:
        await _reach_http_client.close()
        _reach_http_client = None
    _reach_service_singleton = None


async def get_institutions_service() -> IInstitutionsService:
    global _institutions_service_singleton, _institutions_http_client
    if _institutions_service_singleton is None:
        async with _lock:
            if _institutions_service_singleton is None:
                _institutions_http_client = _build_compass_http_client()
                user_service = await get_user_service()
                _institutions_service_singleton = InstitutionsService(
                    repository=CompassInstitutionsRepository(_institutions_http_client),
                    user_service=user_service,
                )
    return _institutions_service_singleton


async def close_institutions_service() -> None:
    """Close the outbound HTTP client and reset the singleton (called on shutdown)."""
    global _institutions_service_singleton, _institutions_http_client
    if _institutions_http_client is not None:
        await _institutions_http_client.close()
        _institutions_http_client = None
    _institutions_service_singleton = None


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


_demographics_lock = asyncio.Lock()
_demographics_service_singleton: IDemographicsService | None = None
_demographics_http_client: AsyncHttpClient | None = None


async def get_demographics_service() -> IDemographicsService:
    global _demographics_service_singleton, _demographics_http_client
    if _demographics_service_singleton is None:
        async with _demographics_lock:
            if _demographics_service_singleton is None:
                _demographics_http_client = _build_compass_http_client()
                user_service = await get_user_service()
                _demographics_service_singleton = DemographicsService(
                    repository=CompassDemographicsRepository(_demographics_http_client),
                    user_service=user_service,
                )
    return _demographics_service_singleton


async def close_demographics_service() -> None:
    """Close the outbound HTTP client and reset the singleton (called on shutdown)."""
    global _demographics_service_singleton, _demographics_http_client
    if _demographics_http_client is not None:
        await _demographics_http_client.close()
        _demographics_http_client = None
    _demographics_service_singleton = None

