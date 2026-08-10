import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.analytics.routes import add_analytics_routes
from app.app_config import ApplicationConfig, set_application_config
from app.auth.api_key import ApiKeyAuth, ExternalService
from app.auth.firebase import Authentication
from app.sentry_init import init_sentry, set_sentry_contexts
from app.server_dependencies.db_dependencies import AnalyticsDBProvider
from app.users.routes import add_users_routes
from app.version.routes import add_version_routes
from app.version.types import VersionInfo
from common_libs.logging.log_utilities import setup_logging_config

load_dotenv()


def _setup_logging() -> None:
    config_file = os.getenv("LOG_CONFIG_FILE", "logging.cfg.yaml")
    config_path = Path(config_file)
    if not config_path.is_absolute():
        config_path = Path(__file__).parent / config_path
    setup_logging_config(str(config_path))


_setup_logging()
logger = logging.getLogger(__name__)


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


def _build_application_config() -> ApplicationConfig:
    frontend_url = _require_env("FRONTEND_URL")
    backend_url = _require_env("BACKEND_URL")
    environment_type = _require_env("TARGET_ENVIRONMENT_TYPE")
    environment_name = _require_env("TARGET_ENVIRONMENT_NAME")
    enable_sentry = _require_env("BACKEND_ENABLE_SENTRY").lower() == "true"
    analytics_mongodb_uri = _require_env("ANALYTICS_MONGODB_URI")
    analytics_database_name = _require_env("ANALYTICS_DATABASE_NAME")

    try:
        sentry_config = json.loads(os.getenv("BACKEND_SENTRY_CONFIG", "{}"))
    except json.JSONDecodeError:
        logger.warning("Could not parse BACKEND_SENTRY_CONFIG as JSON, falling back to {}.")
        sentry_config = {}

    return ApplicationConfig(
        version_info=VersionInfo(
            date=os.getenv("VERSION_DATE", "N/A"),
            branch=os.getenv("VERSION_BRANCH", "N/A"),
            buildNumber=os.getenv("VERSION_BUILD_NUMBER", "N/A"),
            sha=os.getenv("VERSION_SHA", "N/A"),
        ),
        environment_type=environment_type,
        environment_name=environment_name,
        frontend_url=frontend_url,
        backend_url=backend_url,
        enable_sentry=enable_sentry,
        sentry_dsn=os.getenv("BACKEND_SENTRY_DSN") or None,
        sentry_config=sentry_config,
        analytics_mongodb_uri=analytics_mongodb_uri,
        analytics_database_name=analytics_database_name,
        firebase_project_id=os.getenv("FIREBASE_PROJECT_ID") or None,
        service_api_keys={
            ExternalService.COMPASS: _require_env("COMPASS_API_KEY"),
        },
        compass_base_url=_require_env("COMPASS_BASE_URL"),
    )


application_config = _build_application_config()
set_application_config(application_config)
init_sentry(application_config)
set_sentry_contexts(application_config)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db = await AnalyticsDBProvider.get_db()
    await AnalyticsDBProvider.initialize_mongo_db(db)
    logger.info("Startup complete.")
    yield
    AnalyticsDBProvider.clear_cache()
    logger.info("Shutdown complete.")


app = FastAPI(
    title="Compass Analytics API",
    version=application_config.version_info.to_version_string(),
    description="Backend API for the Compass Analytics dashboard.",
    redirect_slashes=False,
    swagger_ui_parameters={"docExpansion": "none"},
    servers=[{"url": application_config.backend_url, "description": "The backend server"}],
    lifespan=lifespan,
)

_cors_origins = [application_config.frontend_url, application_config.backend_url + "/docs"]
if application_config.environment_type in ("dev", "local"):
    _cors_origins.append("*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_key_auth = ApiKeyAuth(keys=application_config.service_api_keys)
firebase_auth = Authentication(firebase_project_id=application_config.firebase_project_id)

add_version_routes(app)
add_users_routes(app, firebase_auth)
add_analytics_routes(app, firebase_auth)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)  # nosec B104 # this will be run in a container
