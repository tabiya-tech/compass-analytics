import logging
from http import HTTPStatus

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Path, Query

from app.auth.firebase import Authentication, UserInfo
from app.jobseekers.access import IJobseekerAccessResolver
from app.jobseekers.dependencies import get_jobseeker_access_resolver, get_jobseekers_service
from app.jobseekers.services import IJobseekersService, JobseekersAccessDenied
from app.jobseekers.types import (
    MODULE_IDS,
    AccessScope,
    JobseekerDetail,
    JobseekerSortKey,
    JobseekersQuery,
    JobseekersResponse,
    ModuleId,
    ModuleStatus,
    SortDirection,
)

logger = logging.getLogger(__name__)

_API_PREFIX = "/api"

_VALID_STATUSES: tuple[ModuleStatus, ...] = ("not_started", "in_progress", "completed")


def _parse_scope(scope: str | None, institution_ids: list[str]) -> AccessScope:
    if scope == "all":
        return AccessScope(type="all")
    return AccessScope(type="institutions", institution_ids=institution_ids)


def _parse_module_status(values: list[str]) -> dict[ModuleId, list[ModuleStatus]]:
    """`module_status=build-your-profile:completed`, repeated — regrouped into one entry per module."""
    filters: dict[ModuleId, list[ModuleStatus]] = {}
    for value in values:
        module_id, separator, status = value.partition(":")
        if not separator or module_id not in MODULE_IDS or status not in _VALID_STATUSES:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"module_status must read '<module>:<status>', got {value!r}",
            )
        filters.setdefault(module_id, []).append(status)  # type: ignore[arg-type]
    return filters


def _query(
    scope: str | None = Query(None, description="'all' to ask for every institution the grant covers"),
    institution_id: list[str] = Query(default_factory=list, description="Institution to scope the roster to; repeatable"),
    search: str | None = Query(None, description="Keeps the jobseekers on the requested page whose name or id matches"),
    module_status: list[str] = Query(
        default_factory=list,
        description="Keep only these statuses for a module, as '<module>:<status>', within the requested page; repeatable",
    ),
    sort_by: JobseekerSortKey = Query("name", description="Orders the requested page; Compass cannot order the roster"),
    sort_dir: SortDirection = Query("asc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> JobseekersQuery:
    return JobseekersQuery(
        scope=_parse_scope(scope, institution_id),
        search=search,
        module_status=_parse_module_status(module_status),
        sort_by=sort_by,
        sort_direction=sort_dir,
        page=page,
        page_size=page_size,
    )


class NotAllowedToViewJobSeekers(HTTPException):
    def __init__(self):
        super().__init__(status_code=HTTPStatus.FORBIDDEN, detail="Not allowed to view these jobseekers.")

def add_jobseekers_routes(app: FastAPI, auth: Authentication) -> None:
    get_user_info = auth.get_user_info()

    router = APIRouter(prefix=_API_PREFIX, tags=["Jobseekers"])

    @router.get(
        "/jobseekers",
        response_model=JobseekersResponse
    )
    async def get_jobseekers(
        query: JobseekersQuery = Depends(_query),
        service: IJobseekersService = Depends(get_jobseekers_service),
        access: IJobseekerAccessResolver = Depends(get_jobseeker_access_resolver),
        user_info: UserInfo = Depends(get_user_info),
    ) -> JobseekersResponse:
        grant = await access.resolve(user_info)
        try:
            return await service.get_jobseekers(query, grant, user_info.token)
        except JobseekersAccessDenied as exc:
            logger.info("Refused a roster request from user %s: %s", user_info.user_id, exc)
            raise NotAllowedToViewJobSeekers() from exc

    @router.get(
        "/jobseekers/{jobseeker_id}",
        response_model=JobseekerDetail
    )
    async def get_jobseeker(
        jobseeker_id: str = Path(..., min_length=1),
        service: IJobseekersService = Depends(get_jobseekers_service),
        access: IJobseekerAccessResolver = Depends(get_jobseeker_access_resolver),
        user_info: UserInfo = Depends(get_user_info),
    ) -> JobseekerDetail:
        grant = await access.resolve(user_info)
        try:
            detail = await service.get_jobseeker(jobseeker_id, grant, user_info.token)
        except JobseekersAccessDenied as exc:
            logger.info("Refused a profile request from user %s: %s", user_info.user_id, exc)
            raise NotAllowedToViewJobSeekers() from exc

        if detail is None:
            raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="No such jobseeker.")
        return detail

    app.include_router(router)
