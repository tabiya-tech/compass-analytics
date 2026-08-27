import logging
from abc import ABC, abstractmethod

import sentry_sdk

from app.analytics.modules.types import (
    BuildYourProfileResponse,
    BuildYourProfileSummary,
    CareerExplorerResponse,
    CareerExplorerSummary,
    CompassBuildYourProfilePayload,
    CompassCareerExplorerPayload,
    CompassJobsPayload,
    ConversationPhaseReach,
    JobReadinessResponse,
    JobsResponse,
    JobsSummary,
    MODULE_KEY_CAREER_EXPLORER,
    MODULE_KEY_JOB_READINESS,
    MODULE_KEY_JOBS,
    UPSTREAM_PATH,
)
from app.shared.filters import AnalyticsFilters
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


def _empty_job_readiness() -> JobReadinessResponse:
    """Graceful zero-response used when the upstream is unavailable."""
    return JobReadinessResponse(started_percentage=0.0, sub_modules=[], degraded=True)


def _empty_career_explorer(degraded: bool) -> CareerExplorerResponse:
    """Graceful zero-response — degraded=True for a real upstream failure, False for legitimately empty data."""
    return CareerExplorerResponse(summary=CareerExplorerSummary(), top_sectors=[], degraded=degraded)


def _empty_jobs(degraded: bool) -> JobsResponse:
    """Graceful zero-response — degraded=True for a real upstream failure, False for legitimately empty data."""
    return JobsResponse(
        summary=JobsSummary(
            jobs_sourced=0,
            profiles_with_matches=0,
            profiles_with_matches_percentage=0.0,
            jobs_viewed_per_user=0.0,
        ),
        degraded=degraded,
    )


class IModulesRepository(ABC):
    @abstractmethod
    async def get_build_your_profile(
        self, institution_ids: list[str] | None, filters: AnalyticsFilters
    ) -> BuildYourProfileResponse: ...

    @abstractmethod
    async def get_job_readiness(
        self, institution_ids: list[str] | None, filters: AnalyticsFilters
    ) -> JobReadinessResponse: ...

    @abstractmethod
    async def get_career_explorer(
        self, institution_ids: list[str] | None, filters: AnalyticsFilters
    ) -> CareerExplorerResponse: ...

    @abstractmethod
    async def get_jobs(self, institution_ids: list[str] | None, filters: AnalyticsFilters) -> JobsResponse: ...


class CompassModulesRepository(IModulesRepository):
    """
    Fetches module analytics from the Compass upstream, one method per module_key.

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

    async def get_job_readiness(
        self, institution_ids: list[str] | None, filters: AnalyticsFilters
    ) -> JobReadinessResponse:
        params = filters.to_upstream_params(institution_ids)
        upstream_path = UPSTREAM_PATH[MODULE_KEY_JOB_READINESS]

        try:
            data = await self._client.get(upstream_path, params=params)
        except HttpClientError as exc:
            logger.warning("Compass modules/%s request failed (%s): %s", MODULE_KEY_JOB_READINESS, exc.status_code, exc)
            sentry_sdk.capture_exception(exc)
            return _empty_job_readiness()
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Compass modules/%s request error: %s", MODULE_KEY_JOB_READINESS, exc)
            sentry_sdk.capture_exception(exc)
            return _empty_job_readiness()

        if not data:
            return _empty_job_readiness()

        try:
            return JobReadinessResponse.model_validate(data)
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Compass modules/%s response failed validation: %s", MODULE_KEY_JOB_READINESS, exc)
            sentry_sdk.capture_exception(exc)
            return _empty_job_readiness()

    async def get_career_explorer(
        self, institution_ids: list[str] | None, filters: AnalyticsFilters
    ) -> CareerExplorerResponse:
        params = filters.to_upstream_params(institution_ids)
        upstream_path = UPSTREAM_PATH[MODULE_KEY_CAREER_EXPLORER]

        try:
            data = await self._client.get(upstream_path, params=params)
        except HttpClientError as exc:
            logger.warning(
                "Compass modules/%s request failed (%s): %s", MODULE_KEY_CAREER_EXPLORER, exc.status_code, exc
            )
            sentry_sdk.capture_exception(exc)
            return _empty_career_explorer(degraded=True)
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Compass modules/%s request error: %s", MODULE_KEY_CAREER_EXPLORER, exc)
            sentry_sdk.capture_exception(exc)
            return _empty_career_explorer(degraded=True)

        if not data:
            return _empty_career_explorer(degraded=False)

        try:
            parsed = CompassCareerExplorerPayload.model_validate(data)
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Compass modules/%s response failed validation: %s", MODULE_KEY_CAREER_EXPLORER, exc)
            sentry_sdk.capture_exception(exc)
            return _empty_career_explorer(degraded=True)

        return CareerExplorerResponse(summary=parsed.to_summary(), top_sectors=parsed.top_sectors, degraded=False)

    async def get_jobs(self, institution_ids: list[str] | None, filters: AnalyticsFilters) -> JobsResponse:
        params = filters.to_upstream_params(institution_ids)
        upstream_path = UPSTREAM_PATH[MODULE_KEY_JOBS]

        try:
            data = await self._client.get(upstream_path, params=params)
        except HttpClientError as exc:
            logger.warning("Compass modules/%s request failed (%s): %s", MODULE_KEY_JOBS, exc.status_code, exc)
            sentry_sdk.capture_exception(exc)
            return _empty_jobs(degraded=True)
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Compass modules/%s request error: %s", MODULE_KEY_JOBS, exc)
            sentry_sdk.capture_exception(exc)
            return _empty_jobs(degraded=True)

        if not data:
            return _empty_jobs(degraded=False)

        try:
            parsed = CompassJobsPayload.model_validate(data)
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Compass modules/%s response failed validation: %s", MODULE_KEY_JOBS, exc)
            sentry_sdk.capture_exception(exc)
            return _empty_jobs(degraded=True)

        return JobsResponse(summary=parsed.summary, degraded=False)
