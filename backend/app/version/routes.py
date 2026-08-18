from fastapi import APIRouter, FastAPI

from app.app_config import get_application_config
from app.version.types import VersionInfo


def add_version_routes(app: FastAPI) -> None:
    router = APIRouter(tags=["Version"], prefix="/api")

    @router.get("/version", response_model=VersionInfo)
    async def get_version() -> VersionInfo:
        """Returns build/version info. Doubles as the health/readiness check."""
        return get_application_config().version_info

    app.include_router(router)
