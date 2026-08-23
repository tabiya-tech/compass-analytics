import logging
from abc import ABC, abstractmethod

import sentry_sdk

from app.analytics.institutions.types import InstitutionsResponse
from common_libs.http_client.base import AsyncHttpClient, HttpClientError

logger = logging.getLogger(__name__)


def _empty_institutions() -> InstitutionsResponse:
    """Graceful zero-response used when the upstream is unavailable."""
    return InstitutionsResponse(institutions=[])


class IInstitutionsRepository(ABC):
    @abstractmethod
    async def get_institutions(self, institution_ids: list[str] | None) -> InstitutionsResponse: ...


class CompassInstitutionsRepository(IInstitutionsRepository):
    """
    Fetches per-institution comparison data from the Compass upstream summary endpoint.

    The upstream computes totals from its full dataset (registered_users) and a fixed
    7-day activity window (active_users_7d) — it does not accept a date range. Only
    institution_ids scoping is forwarded. Same degradation contract as the reach
    repository: upstream failures return an empty payload and are reported to Sentry.
    """

    def __init__(self, http_client: AsyncHttpClient):
        self._client = http_client

    async def get_institutions(self, institution_ids: list[str] | None) -> InstitutionsResponse:
        params: dict = {}
        if institution_ids:
            params["institution_ids"] = ",".join(institution_ids)

        try:
            data = await self._client.get("/analytics/institutions/summary", params=params)
        except HttpClientError as exc:
            logger.warning("Compass institutions request failed (%s): %s", exc.status_code, exc)
            sentry_sdk.capture_exception(exc)
            return _empty_institutions()
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Compass institutions request error: %s", exc)
            sentry_sdk.capture_exception(exc)
            return _empty_institutions()

        if not data:
            return _empty_institutions()

        try:
            return InstitutionsResponse.model_validate(data)
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Compass institutions response failed validation: %s", exc)
            sentry_sdk.capture_exception(exc)
            return _empty_institutions()
