import logging
from abc import ABC, abstractmethod

from app.analytics.institutions.repository import IInstitutionsRepository
from app.analytics.institutions.types import InstitutionsResponse
from app.analytics.reach.types import AnalyticsFilters
from app.auth.firebase import UserInfo
from app.users.service import IUserService

logger = logging.getLogger(__name__)


class IInstitutionsService(ABC):
    @abstractmethod
    async def get_institutions(self, filters: AnalyticsFilters, user_info: UserInfo) -> InstitutionsResponse: ...


class InstitutionsService(IInstitutionsService):
    def __init__(self, repository: IInstitutionsRepository, user_service: IUserService):
        self._repo = repository
        self._users = user_service

    async def get_institutions(self, filters: AnalyticsFilters, user_info: UserInfo) -> InstitutionsResponse:
        # Scope resolution determines which institution_ids to pass to the upstream.
        # The upstream does not accept a date range — it computes totals from its
        # full dataset and a fixed 7-day activity window.
        scope = await self._users.resolve_scope(user_info, filters.institution_id)
        return await self._repo.get_institutions(scope.institution_ids)
