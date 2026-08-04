from typing import Optional

from pydantic import BaseModel

from app.auth.api_key import ExternalService
from app.version.types import VersionInfo


class ApplicationConfig(BaseModel):
    """
    Process-wide application configuration, built once from environment
    variables at server startup (see app/server.py) and read via
    get_application_config() everywhere else. Not a pydantic-settings
    BaseSettings itself, since some fields (e.g. version_info) are computed
    rather than read directly from a single env var.
    """

    version_info: VersionInfo

    environment_type: str
    environment_name: str

    frontend_url: str
    backend_url: str

    enable_sentry: bool
    sentry_dsn: Optional[str] = None
    sentry_config: dict = {}

    analytics_mongodb_uri: str
    analytics_database_name: str

    firebase_project_id: Optional[str] = None
    service_api_keys: dict[ExternalService, str]
    compass_base_url: str


_application_config: Optional[ApplicationConfig] = None


def set_application_config(config: ApplicationConfig) -> None:
    global _application_config
    _application_config = config


def get_application_config() -> ApplicationConfig:
    if _application_config is None:
        raise RuntimeError("ApplicationConfig has not been set. Call set_application_config() first.")
    return _application_config


def clear_application_config() -> None:
    """Test-only: reset the singleton between tests that set their own config."""
    global _application_config
    _application_config = None
