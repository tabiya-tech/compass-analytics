import logging

from fastapi import APIRouter, Depends, FastAPI, HTTPException, status

from app.auth.firebase import Authentication, UserInfo
from app.users.dependencies import get_user_service
from app.users.service import IUserService, UserNotProvisionedError
from app.users.types import MeResponse

logger = logging.getLogger(__name__)

_API_PREFIX = "/api"


def add_users_routes(app: FastAPI, auth: Authentication) -> None:
    get_user_info = auth.get_user_info()

    router = APIRouter(
        prefix=_API_PREFIX,
        tags=["Users"],
    )

    @router.get("/me", response_model=MeResponse)
    async def get_me(
        user_info: UserInfo = Depends(get_user_info),
        service: IUserService = Depends(get_user_service),
    ) -> MeResponse:
        try:
            return await service.get_me(user_info)
        except UserNotProvisionedError as exc:
            # Authenticated, but no profile yet — first login before an admin
            # has provisioned this user. The frontend treats this as a signal
            # to show a "pending access" state rather than an error.
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No user profile found. Your access has not been provisioned yet.",
            ) from exc

    app.include_router(router)
