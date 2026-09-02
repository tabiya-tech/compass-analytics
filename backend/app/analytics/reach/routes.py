import logging
from typing import Union

from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, status

from app.analytics.dependencies import get_reach_service
from app.analytics.reach.service import IReachService
from app.analytics.reach.types import ReachResponse
from app.auth.errors import InvalidTokenErrorResponse
from app.auth.firebase import Authentication, UserInfo
from app.casbin.requires import CasbinAPIRouter, make_requires
from app.errors import ForbiddenInstitutionErrorResponse
from app.shared.filters import AnalyticsFiltersDep, verify_basic_filters
from app.users.dependencies import get_role_repository, get_user_role_repository
from app.users.errors import ForbiddenInstitutionError, NotProvisionedForbiddenErrorResponse, UserNotProvisionedError
from app.users.types import Action, Subject

logger = logging.getLogger(__name__)


def add_reach_routes(router: APIRouter, auth: Authentication) -> None:
    get_user_info = auth.get_user_info()
    requires = make_requires(get_user_info, get_role_repository, get_user_role_repository)

    reach_router = CasbinAPIRouter(requires_factory=requires, )

    @reach_router.get("/reach", response_model=ReachResponse, responses={
        HTTPStatus.UNAUTHORIZED: {"model": InvalidTokenErrorResponse, "description": "Missing or invalid authentication token."},
        HTTPStatus.FORBIDDEN: {
            "model": Union[NotProvisionedForbiddenErrorResponse, ForbiddenInstitutionErrorResponse],
            "description": "User has not been provisioned with dashboard access, or does not have access to the requested institution.",
        },
    })
    @requires(Subject.DASHBOARD, Action.VIEW, resolves_scope=True)
    async def get_reach(
        filters: AnalyticsFiltersDep,
        user_info: UserInfo = Depends(get_user_info),
        service: IReachService = Depends(get_reach_service),
    ) -> ReachResponse:
        # AnalyticsFiltersDep has already parsed these, so this re-check costs one
        # validation and normally passes. It is here because it is the contract's entry
        # point: any handler that comes by its filters some other way needs it, and having
        # the call visible keeps "verify, then process" the same shape in every module.
        filters = verify_basic_filters(filters)

        try:
            return await service.get_reach(filters, user_info)
        except UserNotProvisionedError as exc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your access has not been provisioned yet.",
            ) from exc
        except ForbiddenInstitutionError as exc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to the requested institution.",
            ) from exc

    router.include_router(reach_router)
