import logging
from abc import ABC, abstractmethod

from app.analytics.modules.repository import IModulesRepository
from app.analytics.modules.types import SUPPORTED_MODULE_KEYS, ModulesResponse
from app.shared.filters import AnalyticsFilters
from app.auth.firebase import UserInfo
from app.users.service import IUserService

logger = logging.getLogger(__name__)


class UnsupportedModuleError(Exception):
    """module_key is not one of the supported analytics modules"""


class IModulesService(ABC):
    @abstractmethod
    async def get_module(self, module_key: str, filters: AnalyticsFilters, user_info: UserInfo) -> ModulesResponse: ...


class ModulesService(IModulesService):
    def __init__(self, repository: IModulesRepository, user_service: IUserService):
        self._repo = repository
        self._users = user_service

    async def get_module(self, module_key: str, filters: AnalyticsFilters, user_info: UserInfo) -> ModulesResponse:
        # Allow-list check happens before any DB or network call.
        if module_key not in SUPPORTED_MODULE_KEYS:
            raise UnsupportedModuleError(module_key)

        scope = await self._users.resolve_scope(user_info, filters.institution_id)

        if module_key == "build-your-profile":
            return await self._repo.get_build_your_profile(scope.institution_ids, filters)
        if module_key == "job-readiness":
            return await self._repo.get_job_readiness(scope.institution_ids, filters)
        if module_key == "jobs":
            return await self._repo.get_jobs(scope.institution_ids, filters)

        raise UnsupportedModuleError(module_key)  # unreachable — SUPPORTED_MODULE_KEYS guard above
