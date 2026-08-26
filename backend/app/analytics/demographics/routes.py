import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.analytics.demographics.service import IDemographicsService
from app.analytics.demographics.types import DemographicsFilters, DemographicsFiltersDep, DemographicsResponse
from app.analytics.dependencies import get_demographics_service
from app.auth.firebase import Authentication, UserInfo
from app.casbin.requires import CasbinAPIRouter, make_requires
from app.shared.filters import verify_basic_filters
from app.users.dependencies import get_grant_repository
from app.users.service import ForbiddenInstitutionError, UserNotProvisionedError
from app.users.types import Action, Subject

logger = logging.getLogger(__name__)


def add_demographics_routes(router: APIRouter, auth: Authentication) -> None:
    get_user_info = auth.get_user_info()
    requires = make_requires(get_user_info, get_grant_repository)

    demographics_router = CasbinAPIRouter(requires_factory=requires)

    @demographics_router.get("/demographics", response_model=DemographicsResponse)
    @requires(Subject.DASHBOARD, Action.VIEW)
    async def get_demographics(
        filters: DemographicsFiltersDep,
        user_info: UserInfo = Depends(get_user_info),
        service: IDemographicsService = Depends(get_demographics_service),
    ) -> DemographicsResponse:
        # Cheap re-validation, kept visible so every module follows "verify, then process".
        filters = verify_basic_filters(filters, DemographicsFilters)

        try:
            return await service.get_demographics(filters, user_info)
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

    router.include_router(demographics_router)
