import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from app.analytics.dependencies import get_modules_service
from app.analytics.modules.service import IModulesService, UnsupportedModuleError
from app.analytics.modules.types import BuildYourProfileResponse
from app.analytics.types import AnalyticsFilters, AudienceSegment, Granularity, LoginMethod
from app.auth.firebase import Authentication, UserInfo
from app.casbin.requires import CasbinAPIRouter, make_requires
from app.users.dependencies import get_grant_repository
from app.users.service import ForbiddenInstitutionError, UserNotProvisionedError
from app.users.types import Action, Subject

logger = logging.getLogger(__name__)


def _filters(
    start_date: date = Query(..., description="Inclusive start date (yyyy-MM-dd)", examples=["YYYY-MM-DD"]),
    end_date: date = Query(..., description="Inclusive end date (yyyy-MM-dd)", examples=["YYYY-MM-DD"]),
    granularity: Granularity = Query(..., description="Time bucket size"),
    audience_segment: AudienceSegment | None = Query(None),
    login_method: LoginMethod | None = Query(None),
    institution_id: str | None = Query(None, description="Drill down to a single institution"),
) -> AnalyticsFilters:
    return AnalyticsFilters(
        start_date=start_date,
        end_date=end_date,
        granularity=granularity,
        audience_segment=audience_segment,
        login_method=login_method,
        institution_id=institution_id,
    )


def add_modules_routes(router: APIRouter, auth: Authentication) -> None:
    get_user_info = auth.get_user_info()
    requires = make_requires(get_user_info, get_grant_repository)

    modules_router = CasbinAPIRouter(requires_factory=requires)

    # str, not a Literal, so an unknown key reaches the service layer and gets a 404, not a 422.
    @modules_router.get("/modules/{module_key}", response_model=BuildYourProfileResponse)
    @requires(Subject.DASHBOARD, Action.VIEW)
    async def get_module(
        module_key: str = Path(..., description="Which module's analytics to fetch, e.g. 'build-your-profile'."),
        user_info: UserInfo = Depends(get_user_info),
        filters: AnalyticsFilters = Depends(_filters),
        service: IModulesService = Depends(get_modules_service),
    ) -> BuildYourProfileResponse:
        try:
            return await service.get_module(module_key, filters, user_info)
        except UnsupportedModuleError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Unknown module '{module_key}'.",
            ) from exc
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

    router.include_router(modules_router)
