import logging
from abc import ABC, abstractmethod
from typing import Final

import sentry_sdk

from app.analytics.institutions.types import CompassInstitutionsResponse
from common_libs.http_client.base import AsyncHttpClient, HttpClientError

logger = logging.getLogger(__name__)

EMPTY_INSTITUTIONS_RESPONSE: Final[CompassInstitutionsResponse] = CompassInstitutionsResponse(institutions=[])


class IInstitutionsRepository(ABC):
    @abstractmethod
    async def get_institutions(self, institution_ids: list[str] | None) -> CompassInstitutionsResponse: ...


class CompassInstitutionsRepository(IInstitutionsRepository):
    """Fetches per-institution comparison data from the Compass summary endpoint (scoped by institution IDs)."""

    def __init__(self, http_client: AsyncHttpClient):
        self._client = http_client

    def _handle_failure(self, message: str, exc: Exception) -> CompassInstitutionsResponse:
        logger.warning(message, exc)
        sentry_sdk.capture_exception(exc)
        return EMPTY_INSTITUTIONS_RESPONSE

    async def get_institutions(self, institution_ids: list[str] | None) -> CompassInstitutionsResponse:
        params: dict = {}
        if institution_ids:
            params["institution_ids"] = ",".join(institution_ids)

        try:
            data = await self._client.get("/analytics/institutions/summary", params=params)
        except HttpClientError as exc:
            return self._handle_failure(f"Compass institutions request failed ({exc.status_code}): %s", exc)
        except Exception as exc:  # pylint: disable=broad-except
            return self._handle_failure("Compass institutions request error: %s", exc)

        if not data:
            return EMPTY_INSTITUTIONS_RESPONSE

        try:
            return CompassInstitutionsResponse.model_validate(data)
        except Exception as exc:  # pylint: disable=broad-except
            return self._handle_failure("Compass institutions response failed validation: %s", exc)
