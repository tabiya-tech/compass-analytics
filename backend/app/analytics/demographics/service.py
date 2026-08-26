import logging
from abc import ABC, abstractmethod

from app.analytics.demographics.repository import IDemographicsRepository
from app.analytics.demographics.types import DemographicsFilters, DemographicsResponse
from app.auth.firebase import UserInfo
from app.users.service import IUserService

logger = logging.getLogger(__name__)


class IDemographicsService(ABC):
    @abstractmethod
    async def get_demographics(self, filters: DemographicsFilters, user_info: UserInfo) -> DemographicsResponse: ...


class DemographicsService(IDemographicsService):
    def __init__(self, repository: IDemographicsRepository, user_service: IUserService):
        self._repo = repository
        self._users = user_service

    async def get_demographics(self, filters: DemographicsFilters, user_info: UserInfo) -> DemographicsResponse:
        # Never trust institution_id alone — resolve the caller's real scope from their grants.
        scope = await self._users.resolve_scope(user_info, filters.institution_id)
        return await self._repo.get_demographics(scope.institution_ids, filters)
