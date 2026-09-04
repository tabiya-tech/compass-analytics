import logging
from http import HTTPStatus

from fastapi import Depends, FastAPI

from app.auth.errors import InvalidTokenErrorResponse
from app.auth.firebase import Authentication
from app.casbin.requires import CasbinAPIRouter, make_requires
from app.roles.types import RoleRecord
from app.users.dependencies import get_role_repository, get_user_role_repository
from app.users.types import Action, Subject

logger = logging.getLogger(__name__)

_API_PREFIX = "/api"


def add_roles_routes(app: FastAPI, auth: Authentication) -> None:
    get_user_info = auth.get_user_info()
    requires = make_requires(get_user_info, get_role_repository, get_user_role_repository)

    router = CasbinAPIRouter(requires_factory=requires, prefix=_API_PREFIX, tags=["Roles"])

    @router.get("/roles", response_model=list[RoleRecord], responses={
        HTTPStatus.UNAUTHORIZED: {"model": InvalidTokenErrorResponse, "description": "Missing or invalid authentication token."},
        HTTPStatus.FORBIDDEN: {"model": None, "description": "Caller does not have access-management permission."},
    })
    @requires(Subject.ACCESS_MANAGEMENT, Action.MANAGE)
    async def list_roles(
        role_repo=Depends(get_role_repository),
    ) -> list[RoleRecord]:
        return await role_repo.list_all()

    app.include_router(router)
