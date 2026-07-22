import logging

import sentry_sdk

from app.app_config import ApplicationConfig

logger = logging.getLogger(__name__)


def init_sentry(config: ApplicationConfig) -> None:
    if not config.enable_sentry:
        logger.info("Sentry is disabled (BACKEND_ENABLE_SENTRY is not set to True).")
        return
    sentry_sdk.init(
        dsn=config.sentry_dsn,
        environment=config.environment_name,
        **config.sentry_config,
    )


def set_sentry_contexts(config: ApplicationConfig) -> None:
    if not config.enable_sentry:
        return
    sentry_sdk.set_context(
        "environment",
        {"type": config.environment_type, "name": config.environment_name},
    )
