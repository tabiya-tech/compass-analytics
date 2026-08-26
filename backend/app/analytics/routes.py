from fastapi import APIRouter, FastAPI

from app.analytics.demographics.routes import add_demographics_routes
from app.analytics.institutions.routes import add_institutions_routes
from app.analytics.modules.routes import add_modules_routes
from app.analytics.reach.routes import add_reach_routes
from app.auth.firebase import Authentication

_API_PREFIX = "/api"


def add_analytics_routes(app: FastAPI, auth: Authentication) -> None:
    router = APIRouter(prefix=_API_PREFIX, tags=["Analytics"])
    add_reach_routes(router, auth)
    add_institutions_routes(router, auth)
    add_modules_routes(router, auth)
    add_demographics_routes(router, auth)
    app.include_router(router)
