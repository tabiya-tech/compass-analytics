import logging
from abc import ABC, abstractmethod

from app.analytics.repositories import IAnalyticsRepository
from app.analytics.types import AnalyticsFilters, ReachResponse

logger = logging.getLogger(__name__)


class IAnalyticsService(ABC):
    @abstractmethod
    async def get_reach(self, filters: AnalyticsFilters) -> ReachResponse: ...


class AnalyticsService(IAnalyticsService):
    def __init__(self, repository: IAnalyticsRepository):
        self._repo = repository

    async def get_reach(self, filters: AnalyticsFilters) -> ReachResponse:
        # institution_id in filters already carries any drill-down scope the
        # frontend specifies. Access control (which institutions a caller may
        # see) will be enforced here once we have a real user identity model.
        institution_ids = [filters.institution_id] if filters.institution_id else None
        return await self._repo.get_reach(institution_ids, filters)
