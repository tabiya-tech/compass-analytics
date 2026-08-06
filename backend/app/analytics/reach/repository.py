import logging
from abc import ABC, abstractmethod

import sentry_sdk

from app.analytics.reach.types import AnalyticsFilters, ReachResponse, ReachSummary
from common_libs.http_client.base import AsyncHttpClient, HttpClientError

logger = logging.getLogger(__name__)


def _empty_reach() -> ReachResponse:
    """Graceful zero-response used when the upstream is unavailable."""
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


class IReachRepository(ABC):
    @abstractmethod
    async def get_reach(self, institution_ids: list[str] | None, filters: AnalyticsFilters) -> ReachResponse: ...


class CompassReachRepository(IReachRepository):
    """
    Fetches reach data from the Compass upstream.

    Product decision: the dashboard never errors — if the upstream is
    unavailable we return an empty/zero ReachResponse so the UI degrades to
    "no data" rather than a failure. But a genuine failure (network error,
    5xx, auth rejection, schema drift) is NOT the same as a legitimately empty
    dataset: failures are reported to Sentry so an outage is visible, while a
    successful-but-empty upstream response simply yields zeros silently.
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
            # An HTTP error (5xx, 401/403 bad key, 404) is an outage/misconfig,
            # not empty data — surface it, then degrade gracefully.
            logger.warning("Compass reach request failed (%s): %s", exc.status_code, exc)
            sentry_sdk.capture_exception(exc)
            return _empty_reach()
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Compass reach request error: %s", exc)
            sentry_sdk.capture_exception(exc)
            return _empty_reach()

        if not data:
            # A successful response with no payload is treated as "no data in
            # range" — the expected empty case, not a failure.
            return _empty_reach()

        try:
            # Parse through the model so extra="forbid" / Field(ge=0) fire at the
            # boundary. Schema drift or an out-of-range value raises here.
            return ReachResponse.model_validate(data)
        except Exception as exc:  # pylint: disable=broad-except
            # Malformed/unexpected upstream payload — report and degrade.
            logger.warning("Compass reach response failed validation: %s", exc)
            sentry_sdk.capture_exception(exc)
            return _empty_reach()
