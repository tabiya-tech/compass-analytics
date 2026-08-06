import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.analytics.dependencies import get_reach_service
from app.analytics.reach.service import IReachService
from app.analytics.reach.types import (
    AnalyticsFilters,
    AudienceSegment,
    Granularity,
    LoginMethod,
    ReachResponse,
)
from app.auth.firebase import Authentication, UserInfo
from app.users.service import ForbiddenInstitutionError, UserNotProvisionedError

logger = logging.getLogger(__name__)


def _filters(
    start_date: date = Query(..., description="Inclusive start date (yyyy-MM-dd)"),
    end_date: date = Query(..., description="Inclusive end date (yyyy-MM-dd)"),
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


def add_reach_routes(router: APIRouter, auth: Authentication) -> None:
    get_user_info = auth.get_user_info()

    @router.get("/reach", response_model=ReachResponse)
    async def get_reach(
        # auth-first: resolve identity before parsing/validating query params
        user_info: UserInfo = Depends(get_user_info),
        filters: AnalyticsFilters = Depends(_filters),
        service: IReachService = Depends(get_reach_service),
    ) -> ReachResponse:
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
