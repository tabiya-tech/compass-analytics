import logging
from abc import ABC, abstractmethod

from app.analytics.reach.repository import IReachRepository
from app.analytics.reach.types import ReachResponse
from app.auth.firebase import UserInfo
from app.shared.filters import AnalyticsFilters
from app.users.service import IUserService

logger = logging.getLogger(__name__)


class IReachService(ABC):
    @abstractmethod
    async def get_reach(self, filters: AnalyticsFilters, user_info: UserInfo) -> ReachResponse: ...


class ReachService(IReachService):
    def __init__(self, repository: IReachRepository, user_service: IUserService):
        self._repo = repository
        self._users = user_service

    async def get_reach(self, filters: AnalyticsFilters, user_info: UserInfo) -> ReachResponse:
        # Resolve which institutions this caller is actually allowed to see from
        # the authoritative `users` collection (CORE-667) — never trust the
        # institution_id filter on its own. resolve_scope raises
        # UserNotProvisionedError / ForbiddenInstitutionError, which the route
        # layer maps to 403.
        scope = await self._users.resolve_scope(user_info, filters.institution_id)
        return await self._repo.get_reach(scope.institution_ids, filters)
