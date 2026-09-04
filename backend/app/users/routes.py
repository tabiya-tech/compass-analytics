import logging

from http import HTTPStatus

from fastapi import Depends, FastAPI, HTTPException, status

from app.auth.errors import InvalidTokenErrorResponse
from app.auth.firebase import Authentication, UserInfo
from app.casbin.requires import CasbinAPIRouter, make_requires
from app.roles.types import AssignRoleRequest, ManagedUser, UserRoleView
from app.users.dependencies import get_role_repository, get_user_role_repository, get_user_service
from app.users.errors import GrantNotFoundError, UnknownRoleError, UserNotProvisionedError, UserNotProvisionedErrorResponse
from app.users.service import IUserService
from app.users.types import Action, MeResponse, RegisterRequest, Subject

logger = logging.getLogger(__name__)

_API_PREFIX = "/api"


def add_users_routes(app: FastAPI, auth: Authentication) -> None:
    get_user_info = auth.get_user_info()
    requires = make_requires(get_user_info, get_role_repository, get_user_role_repository)

    router = CasbinAPIRouter(requires_factory=requires, prefix=_API_PREFIX, tags=["Users"])

    @router.post("/users/register", status_code=status.HTTP_201_CREATED, responses={
        HTTPStatus.UNAUTHORIZED: {"model": InvalidTokenErrorResponse, "description": "Missing or invalid authentication token."},
    })
    async def register(
        body: RegisterRequest | None = None,
        user_info: UserInfo = Depends(get_user_info),
        service: IUserService = Depends(get_user_service),
    ) -> None:
        logger.info("register endpoint hit for user_id=%s", user_info.user_id)
        await service.register(user_info, body or RegisterRequest())
        logger.info("register complete for user_id=%s", user_info.user_id)

    @router.get("/me", response_model=MeResponse, responses={
        HTTPStatus.UNAUTHORIZED: {"model": InvalidTokenErrorResponse, "description": "Missing or invalid authentication token."},
        HTTPStatus.NOT_FOUND: {"model": UserNotProvisionedErrorResponse, "description": "The authenticated user has no provisioned profile."},
    })
    async def get_me(
        user_info: UserInfo = Depends(get_user_info),
        service: IUserService = Depends(get_user_service),
    ) -> MeResponse:
        try:
            return await service.get_me(user_info)
        except UserNotProvisionedError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No user profile found. Your access has not been provisioned yet.",
            ) from exc

    @router.get("/users", response_model=list[ManagedUser], responses={
        HTTPStatus.UNAUTHORIZED: {"model": InvalidTokenErrorResponse, "description": "Missing or invalid authentication token."},
        HTTPStatus.FORBIDDEN: {"model": None, "description": "Caller does not have access-management permission."},
        HTTPStatus.NOT_FOUND: {"model": UserNotProvisionedErrorResponse, "description": "The authenticated user has no provisioned profile."},
    })
    @requires(Subject.ACCESS_MANAGEMENT, Action.MANAGE)
    async def list_users(
        user_info: UserInfo = Depends(get_user_info),
        service: IUserService = Depends(get_user_service),
    ) -> list[ManagedUser]:
        try:
            return await service.list_managed_users(user_info)
        except UserNotProvisionedError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not provisioned.") from exc

    @router.post("/users/{target_user_id}/roles", response_model=UserRoleView, status_code=status.HTTP_201_CREATED, responses={
        HTTPStatus.UNAUTHORIZED: {"model": InvalidTokenErrorResponse, "description": "Missing or invalid authentication token."},
        HTTPStatus.FORBIDDEN: {"model": None, "description": "Caller does not have access-management permission."},
        HTTPStatus.NOT_FOUND: {"model": UserNotProvisionedErrorResponse, "description": "The authenticated user has no provisioned profile."},
        HTTPStatus.UNPROCESSABLE_ENTITY: {"model": None, "description": "The role_id in the request body does not match a known role."},
    })
    @requires(Subject.ACCESS_MANAGEMENT, Action.MANAGE)
    async def assign_role(
        target_user_id: str,
        body: AssignRoleRequest,
        user_info: UserInfo = Depends(get_user_info),
        service: IUserService = Depends(get_user_service),
    ) -> UserRoleView:
        try:
            return await service.assign_role(user_info, target_user_id, body)
        except UserNotProvisionedError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not provisioned.") from exc
        except UnknownRoleError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Unknown role: {exc}") from exc

    @router.delete("/users/{target_user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT, responses={
        HTTPStatus.UNAUTHORIZED: {"model": InvalidTokenErrorResponse, "description": "Missing or invalid authentication token."},
        HTTPStatus.FORBIDDEN: {"model": None, "description": "Caller does not have access-management permission."},
        HTTPStatus.NOT_FOUND: {"model": None, "description": "No assignment for this role and user exists."},
    })
    @requires(Subject.ACCESS_MANAGEMENT, Action.MANAGE)
    async def revoke_role(
        target_user_id: str,
        role_id: str,
        user_info: UserInfo = Depends(get_user_info),
        service: IUserService = Depends(get_user_service),
    ) -> None:
        try:
            await service.revoke_role(user_info, target_user_id, role_id)
        except UserNotProvisionedError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not provisioned.") from exc
        except GrantNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User role not found.") from exc

    app.include_router(router)
