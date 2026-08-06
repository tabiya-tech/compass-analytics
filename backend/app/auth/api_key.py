import logging
from enum import Enum

logger = logging.getLogger(__name__)


class ExternalService(str, Enum):
    COMPASS = "compass"


class ApiKeyAuth:
    """
    Registry of per-service API keys this backend uses for OUTBOUND calls to
    external services.

    Each external service is assigned its own key, loaded from environment
    variables at startup. Callers look a key up by service via key_for() when
    calling out (e.g. this backend calling Compass as a client).

    This is outbound-only: inbound requests to this backend are authenticated
    with Firebase (see app/auth/firebase.py), not API keys.

    Usage:
        api_keys = ApiKeyAuth(config.service_api_keys)
        headers = {"X-API-Key": api_keys.key_for(ExternalService.COMPASS)}
    """

    def __init__(self, keys: dict[ExternalService, str]):
        if not keys:
            raise ValueError("At least one service API key must be configured.")
        for service, key in keys.items():
            if not key:
                raise ValueError(f"API key for service '{service}' must not be empty.")
        self._keys = keys

    def key_for(self, service: ExternalService) -> str:
        """Return the configured key for a specific service (for outbound requests)."""
        key = self._keys.get(service)
        if not key:
            raise KeyError(f"No API key configured for service '{service}'.")
        return key
