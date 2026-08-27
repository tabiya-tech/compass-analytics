import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.analytics.dependencies import get_institutions_service
from app.analytics.institutions.service import IInstitutionsService
from app.analytics.institutions.types import InstitutionsResponse
from app.auth.firebase import Authentication, UserInfo
from app.casbin.requires import CasbinAPIRouter, make_requires
from app.shared.filters import AnalyticsFiltersDep, verify_basic_filters
from app.users.dependencies import get_grant_repository
from app.errors import HTTPErrorResponse
from app.users.errors import ForbiddenInstitutionError, UserNotProvisionedError
from app.users.types import Action, Subject

logger = logging.getLogger(__name__)


def add_institutions_routes(router: APIRouter, auth: Authentication) -> None:
    get_user_info = auth.get_user_info()
    requires = make_requires(get_user_info, get_grant_repository)

    institutions_router = CasbinAPIRouter(requires_factory=requires)

    @institutions_router.get("/analytics/institutions", response_model=InstitutionsResponse, responses={403: {"model": HTTPErrorResponse}, 401: {"model": HTTPErrorResponse}})
    @requires(Subject.DASHBOARD, Action.VIEW)
    async def get_institutions(
        filters: AnalyticsFiltersDep,
        user_info: UserInfo = Depends(get_user_info),
        service: IInstitutionsService = Depends(get_institutions_service),
    ) -> InstitutionsResponse:
        filters = verify_basic_filters(filters)

        try:
            return await service.get_institutions(filters, user_info)
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

    router.include_router(institutions_router)
