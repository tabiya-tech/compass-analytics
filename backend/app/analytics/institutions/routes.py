import logging
from typing import Optional, Union

from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.analytics.dependencies import get_institutions_service
from app.analytics.institutions.service import IInstitutionsService
from app.analytics.institutions.types import InstitutionDetail, InstitutionsResponse
from app.auth.errors import InvalidTokenErrorResponse
from app.auth.firebase import Authentication, UserInfo
from app.casbin.requires import CasbinAPIRouter, make_requires
from app.errors import ForbiddenInstitutionErrorResponse
from app.users.dependencies import get_role_repository, get_user_role_repository
from app.users.errors import ForbiddenInstitutionError, NotProvisionedForbiddenErrorResponse, UserNotProvisionedError
from app.users.types import Action, Subject

logger = logging.getLogger(__name__)


def add_institutions_routes(router: APIRouter, auth: Authentication) -> None:
    get_user_info = auth.get_user_info()
    requires = make_requires(get_user_info, get_role_repository, get_user_role_repository)

    institutions_router = CasbinAPIRouter(requires_factory=requires, )

    @institutions_router.get("/analytics/institutions", response_model=InstitutionsResponse, responses={
        HTTPStatus.UNAUTHORIZED: {"model": InvalidTokenErrorResponse, "description": "Missing or invalid authentication token."},
        HTTPStatus.FORBIDDEN: {
            "model": Union[NotProvisionedForbiddenErrorResponse, ForbiddenInstitutionErrorResponse],
            "description": "User has not been provisioned with dashboard access, or does not have access to the requested institution.",
        },
    })
    @requires(Subject.DASHBOARD, Action.VIEW, resolves_scope=True)
    async def get_institutions(
        institution_id: Optional[str] = Query(default=None, description="Drill down to a single institution."),
        user_info: UserInfo = Depends(get_user_info),
        service: IInstitutionsService = Depends(get_institutions_service),
    ) -> InstitutionsResponse:
        try:
            return await service.get_institutions(institution_id, user_info)
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

    @institutions_router.get("/analytics/institutions/{inst_id}", response_model=InstitutionDetail, responses={
        HTTPStatus.UNAUTHORIZED: {"model": InvalidTokenErrorResponse, "description": "Missing or invalid authentication token."},
        HTTPStatus.NOT_FOUND: {"description": "Institution not found or not accessible."},
        HTTPStatus.FORBIDDEN: {
            "model": Union[NotProvisionedForbiddenErrorResponse, ForbiddenInstitutionErrorResponse],
            "description": "User has not been provisioned with dashboard access.",
        },
    })
    @requires(Subject.DASHBOARD, Action.VIEW, resolves_scope=True)
    async def get_institution(
        inst_id: str,
        user_info: UserInfo = Depends(get_user_info),
        service: IInstitutionsService = Depends(get_institutions_service),
    ) -> InstitutionDetail:
        try:
            detail = await service.get_institution(inst_id, user_info)
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

        if detail is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institution not found.")

        return detail

    router.include_router(institutions_router)
