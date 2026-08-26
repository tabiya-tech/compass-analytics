import logging
from abc import ABC, abstractmethod

import sentry_sdk

from app.analytics.demographics.types import DemographicChart, DemographicsFilters, DemographicsResponse
from common_libs.http_client.base import AsyncHttpClient, HttpClientError

logger = logging.getLogger(__name__)


def _empty_demographics(degraded: bool) -> DemographicsResponse:
    """Graceful empty-response — degraded=True for a real upstream failure, False for legitimately empty data."""
    return DemographicsResponse(charts=[], degraded=degraded)


def _parse_charts(data: list) -> tuple[list[DemographicChart], bool]:
    """Validates each chart independently, so one bad chart doesn't drop the rest."""
    charts: list[DemographicChart] = []
    any_invalid = False
    for raw in data:
        try:
            charts.append(DemographicChart.model_validate(raw))
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Compass demographics chart failed validation: %s", exc)
            sentry_sdk.capture_exception(exc)
            any_invalid = True
    return charts, any_invalid


class IDemographicsRepository(ABC):
    @abstractmethod
    async def get_demographics(
        self, institution_ids: list[str] | None, filters: DemographicsFilters
    ) -> DemographicsResponse: ...


class CompassDemographicsRepository(IDemographicsRepository):
    """Fetches demographics from Compass; degrades to empty charts on failure (degraded=True) or no data (False)."""

    def __init__(self, http_client: AsyncHttpClient):
        self._client = http_client

    async def get_demographics(
        self, institution_ids: list[str] | None, filters: DemographicsFilters
    ) -> DemographicsResponse:
        params = filters.to_upstream_params(institution_ids)

        try:
            data = await self._client.get("/analytics/demographics", params=params)
        except HttpClientError as exc:
            logger.warning("Compass demographics request failed (%s): %s", exc.status_code, exc)
            sentry_sdk.capture_exception(exc)
            return _empty_demographics(degraded=True)
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Compass demographics request error: %s", exc)
            sentry_sdk.capture_exception(exc)
            return _empty_demographics(degraded=True)

        if not data:
            # A successful response with no charts is treated as "no data yet" — the
            # expected empty case, not a failure.
            return _empty_demographics(degraded=False)

        if not isinstance(data, list):
            logger.warning("Compass demographics response was not a list: %r", type(data))
            sentry_sdk.capture_message("Compass demographics response was not a list", level="warning")
            return _empty_demographics(degraded=True)

        charts, any_invalid = _parse_charts(data)
        return DemographicsResponse(charts=charts, degraded=any_invalid)
