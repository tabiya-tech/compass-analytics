import logging
import secrets
from enum import Enum
from typing import Callable

from fastapi import Depends, HTTPException
from fastapi.security import APIKeyHeader

logger = logging.getLogger(__name__)

_API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=True)


class ExternalService(str, Enum):
    COMPASS = "compass"


class ApiKeyAuth:
    """
    Validates the X-API-Key header against a registry of per-service secrets.

    Each external service that calls this backend is assigned its own key,
    loaded from environment variables at startup. The registry maps an
    ExternalService to its secret so callers can also look up a key by service
    (e.g. when this backend calls out to Compass as a client).

    Usage as a route dependency:
        Depends(api_key_auth.require())

    Usage for outbound calls:
        api_key_auth.key_for(ExternalService.COMPASS)
    """

    def __init__(self, keys: dict[ExternalService, str]):
        if not keys:
            raise ValueError("At least one service API key must be configured.")
        for service, key in keys.items():
            if not key:
                raise ValueError(f"API key for service '{service}' must not be empty.")
        self._keys = keys
        # Pre-build the set of valid keys for O(n) lookup; n is tiny.
        self._valid_keys = set(keys.values())

    def require(self) -> Callable:
        """FastAPI dependency — rejects requests whose X-API-Key is not in the registry."""
        def _check(key: str = Depends(_API_KEY_HEADER)) -> None:
            if not any(secrets.compare_digest(key, valid) for valid in self._valid_keys):
                logger.warning("Rejected request with invalid API key.")
                raise HTTPException(status_code=401, detail="Invalid API key.")

        return _check


    def key_for(self, service: ExternalService) -> str:
        """Return the configured key for a specific service (for outbound requests)."""
        key = self._keys.get(service)
        if not key:
            raise KeyError(f"No API key configured for service '{service}'.")
        return key
