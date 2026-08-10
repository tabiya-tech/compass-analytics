import logging
from abc import ABC, abstractmethod

from app.analytics.repositories import IAnalyticsRepository
from app.analytics.types import AnalyticsFilters, ReachResponse
from app.auth.firebase import UserInfo
from app.users.service import IUserService

logger = logging.getLogger(__name__)


class IAnalyticsService(ABC):
    @abstractmethod
    async def get_reach(self, filters: AnalyticsFilters, user_info: UserInfo) -> ReachResponse: ...


class AnalyticsService(IAnalyticsService):
    def __init__(self, repository: IAnalyticsRepository, user_service: IUserService):
        self._repo = repository
        self._users = user_service

    async def get_reach(self, filters: AnalyticsFilters, user_info: UserInfo) -> ReachResponse:
        # Resolve which institutions this caller is actually allowed to see from
        # the authoritative `users` collection — never trust the institution_id
        # filter on its own. Raises UserNotProvisionedError / ForbiddenInstitutionError,
        # which the route layer maps to 403.
        scope = await self._users.resolve_scope(user_info, filters.institution_id)
        return await self._repo.get_reach(scope.institution_ids, filters)
