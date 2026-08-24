import logging
from abc import ABC, abstractmethod

import sentry_sdk

from app.analytics.modules.types import (
    BuildYourProfileResponse,
    BuildYourProfileSummary,
    CompassBuildYourProfilePayload,
    ConversationPhaseReach,
)
from app.analytics.types import AnalyticsFilters
from common_libs.http_client.base import AsyncHttpClient, HttpClientError

logger = logging.getLogger(__name__)


_EMPTY_PHASES = [
    ConversationPhaseReach(id="intro", reached=0),
    ConversationPhaseReach(id="experiences", reached=0),
    ConversationPhaseReach(id="skills", reached=0),
    ConversationPhaseReach(id="completed", reached=0),
]


def _empty_build_your_profile(degraded: bool) -> BuildYourProfileResponse:
    """Graceful zero-response — degraded=True for a real upstream failure, False for legitimately empty data."""
    return BuildYourProfileResponse(
        summary=BuildYourProfileSummary(
            started_users=0,
            started_percentage=0.0,
            completed_users=0,
            avg_completion_minutes=0.0,
        ),
        series=[],
        phases=_EMPTY_PHASES,
        degraded=degraded,
    )


class IModulesRepository(ABC):
    @abstractmethod
    async def get_build_your_profile(
        self, institution_ids: list[str] | None, filters: AnalyticsFilters
    ) -> BuildYourProfileResponse: ...


class CompassModulesRepository(IModulesRepository):
    """
    Fetches Build Your Profile module analytics from the Compass upstream.

    A genuine failure degrades to zeros with `degraded=True`; a legitimately empty response
    degrades to the same zeros but `degraded=False`.
    """

    def __init__(self, http_client: AsyncHttpClient):
        self._client = http_client

    async def get_build_your_profile(
        self, institution_ids: list[str] | None, filters: AnalyticsFilters
    ) -> BuildYourProfileResponse:
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
            data = await self._client.get("/analytics/modules/build-your-profile", params=params)
        except HttpClientError as exc:
            logger.warning("Compass build-your-profile request failed (%s): %s", exc.status_code, exc)
            sentry_sdk.capture_exception(exc)
            return _empty_build_your_profile(degraded=True)
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Compass build-your-profile request error: %s", exc)
            sentry_sdk.capture_exception(exc)
            return _empty_build_your_profile(degraded=True)

        if not data:
            return _empty_build_your_profile(degraded=False)

        try:
            parsed = CompassBuildYourProfilePayload.model_validate(data)
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Compass build-your-profile response failed validation: %s", exc)
            sentry_sdk.capture_exception(exc)
            return _empty_build_your_profile(degraded=True)

        return BuildYourProfileResponse(summary=parsed.summary, series=parsed.series, phases=parsed.phases, degraded=False)
