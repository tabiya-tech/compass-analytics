import logging

from fastapi import Depends, FastAPI, HTTPException, status

from app.auth.firebase import Authentication, UserInfo
from app.grants.types import GrantRequest, GrantView, ManagedUser, RoleRequest
from app.casbin.requires import CasbinAPIRouter, make_requires
from app.users.dependencies import get_grant_repository, get_user_service
from app.users.service import IUserService, UnknownRoleError, UserNotProvisionedError
from app.users.types import Action, MeResponse, Subject

logger = logging.getLogger(__name__)

_API_PREFIX = "/api"


def add_users_routes(app: FastAPI, auth: Authentication) -> None:
    get_user_info = auth.get_user_info()
    requires = make_requires(get_user_info, get_grant_repository)

    router = CasbinAPIRouter(requires_factory=requires, prefix=_API_PREFIX, tags=["Users"])

    @router.post("/users/register", status_code=status.HTTP_201_CREATED)
    async def register(
        user_info: UserInfo = Depends(get_user_info),
        service: IUserService = Depends(get_user_service),
    ) -> None:
        logger.info("register endpoint hit for user_id=%s", user_info.user_id)
        await service.register(user_info)
        logger.info("register complete for user_id=%s", user_info.user_id)

    @router.get("/me", response_model=MeResponse)
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

    @router.get("/users", response_model=list[ManagedUser])
    @requires(Subject.ACCESS_MANAGEMENT, Action.MANAGE)
    async def list_users(
        user_info: UserInfo = Depends(get_user_info),
        service: IUserService = Depends(get_user_service),
    ) -> list[ManagedUser]:
        try:
            return await service.list_managed_users(user_info)
        except UserNotProvisionedError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not provisioned.") from exc

    @router.post("/users/{target_user_id}/grants", response_model=GrantView, status_code=status.HTTP_201_CREATED)
    @requires(Subject.ACCESS_MANAGEMENT, Action.MANAGE)
    async def create_grant(
        target_user_id: str,
        body: GrantRequest,
        user_info: UserInfo = Depends(get_user_info),
        service: IUserService = Depends(get_user_service),
    ) -> GrantView:
        try:
            return await service.grant(user_info, target_user_id, body)
        except UserNotProvisionedError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not provisioned.") from exc

    @router.post("/users/{target_user_id}/roles", response_model=list[GrantView], status_code=status.HTTP_201_CREATED)
    @requires(Subject.ACCESS_MANAGEMENT, Action.MANAGE)
    async def assign_role(
        target_user_id: str,
        body: RoleRequest,
        user_info: UserInfo = Depends(get_user_info),
        service: IUserService = Depends(get_user_service),
    ) -> list[GrantView]:
        try:
            return await service.assign_role(user_info, target_user_id, body)
        except UserNotProvisionedError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not provisioned.") from exc
        except UnknownRoleError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Unknown role: {exc}") from exc

    @router.delete("/users/{target_user_id}/grants/{grant_id}", status_code=status.HTTP_204_NO_CONTENT)
    @requires(Subject.ACCESS_MANAGEMENT, Action.MANAGE)
    async def revoke_grant(
        target_user_id: str,
        grant_id: str,
        user_info: UserInfo = Depends(get_user_info),
        service: IUserService = Depends(get_user_service),
    ) -> None:
        try:
            await service.revoke(user_info, target_user_id, grant_id)
        except UserNotProvisionedError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not provisioned.") from exc
        except KeyError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grant not found.") from exc

    app.include_router(router)
