import logging
from enum import Enum

logger = logging.getLogger(__name__)


class EnvironmentType(str, Enum):
    """
    The deployment environment this process runs in, sourced from the
    TARGET_ENVIRONMENT_TYPE env var. Used to decide auth behaviour (LOCAL skips
    Firebase signature verification) and CORS permissiveness.
    """

    LOCAL = "local"
    DEV = "dev"
    TEST = "test"
    PROD = "prod"

    @classmethod
    def from_string(cls, value: str | None) -> "EnvironmentType":
        """
        Parse an env-var string into an EnvironmentType.

        An unknown/missing value falls back to PROD — the safe default: it keeps
        Firebase signature verification on and CORS locked down, so a typo'd or
        unset TARGET_ENVIRONMENT_TYPE can never accidentally disable auth.
        """
        try:
            return cls(value)
        except ValueError:
            logger.warning(
                "Unknown TARGET_ENVIRONMENT_TYPE %r; defaulting to PROD (auth-verifying).", value
            )
            return cls.PROD
