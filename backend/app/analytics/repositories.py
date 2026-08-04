import logging
from abc import ABC, abstractmethod

from app.analytics.types import (
    AnalyticsFilters,
    ReachResponse,
    ReachSummary,
    TimeSeriesPoint,
)
from common_libs.http_client.base import AsyncHttpClient, HttpClientError

logger = logging.getLogger(__name__)


class IAnalyticsRepository(ABC):
    @abstractmethod
    async def get_reach(self, institution_ids: list[str] | None, filters: AnalyticsFilters) -> ReachResponse: ...


class CompassAnalyticsRepository(IAnalyticsRepository):
    """
    Fetches analytics data from the Compass API.
    Returns empty/zero data if the API is unavailable or returns nothing —
    the Compass API endpoints don't exist yet and will be added incrementally.
    """

    def __init__(self, http_client: AsyncHttpClient):
        self._client = http_client

    async def get_reach(self, institution_ids: list[str] | None, filters: AnalyticsFilters) -> ReachResponse:
        params: dict = {
            "start_date": filters.start_date.isoformat(),
            "end_date": filters.end_date.isoformat(),
            "granularity": filters.granularity,
        }
        if institution_ids:
            params["institution_ids"] = ",".join(institution_ids)
        if filters.audience_segment:
            params["audience_segment"] = filters.audience_segment
        if filters.login_method:
            params["login_method"] = filters.login_method

        try:
            data = await self._client.get("/analytics/reach", params=params)
        except HttpClientError as exc:
            logger.warning("Compass API reach request failed (%s): %s", exc.status_code, exc)
            data = None
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Compass API reach request error: %s", exc)
            data = None

        if not data:
            return ReachResponse(
                summary=ReachSummary(
                    total_users=0,
                    active_users_30d=0,
                    total_logins=0,
                    avg_logins_per_user=0.0,
                    avg_session_minutes=0,
                ),
                series=[],
            )

        summary_raw = data.get("summary", {})
        series_raw = data.get("series", [])

        return ReachResponse(
            summary=ReachSummary(
                total_users=summary_raw.get("total_users", 0),
                active_users_30d=summary_raw.get("active_users_30d", 0),
                total_logins=summary_raw.get("total_logins", 0),
                avg_logins_per_user=summary_raw.get("avg_logins_per_user", 0.0),
                avg_session_minutes=summary_raw.get("avg_session_minutes", 0),
            ),
            series=[
                TimeSeriesPoint(
                    label=pt.get("label", ""),
                    cumulative=pt.get("cumulative", 0),
                    added=pt.get("added", 0),
                    new_users=pt.get("new_users", 0),
                    returning=pt.get("returning", 0),
                    logins=pt.get("logins", 0),
                )
                for pt in series_raw
            ],
        )
