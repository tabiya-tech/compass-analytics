import logging
from http import HTTPStatus
from typing import get_args

from fastapi import Depends, FastAPI, HTTPException, Path, Query

from app.auth.firebase import Authentication, UserInfo
from app.casbin.requires import CasbinAPIRouter, ResolvedScope, make_requires
from app.jobseekers.dependencies import get_jobseekers_service
from app.jobseekers.services import IJobseekersService, JobseekersAccessDenied
from app.jobseekers.types import (
    AccessScope,
    JobseekerDetail,
    JobseekerSortKey,
    JobseekersQuery,
    JobseekersResponse,
    ModuleId,
    ModuleStatus,
    SortDirection,
)
from app.users.dependencies import get_role_repository, get_user_role_repository
from app.users.types import Action, Subject

logger = logging.getLogger(__name__)

_API_PREFIX = "/api"


def _parse_module_status(values: list[str]) -> dict[ModuleId, list[ModuleStatus]]:
    """`module_status=build-your-profile:completed`, repeated — regrouped into one entry per module."""
    valid_modules = get_args(ModuleId)
    valid_statuses = get_args(ModuleStatus)
    filters: dict[ModuleId, list[ModuleStatus]] = {}
    for value in values:
        module_id, separator, status = value.partition(":")
        if not separator or module_id not in valid_modules or status not in valid_statuses:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=f"module_status must read '<module>:<status>', got {value!r}",
            )
        filters.setdefault(module_id, []).append(status)  # type: ignore[arg-type]
    return filters


def _query(
    scope: str | None = Query(None, description="'all' to ask for every institution the role covers"),
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
        scope=AccessScope(type="all") if scope == "all" else AccessScope(type="institutions", institution_ids=institution_id),
        search=search,
        module_status=_parse_module_status(module_status),
        sort_by=sort_by,
        sort_direction=sort_dir,
        page=page,
        page_size=page_size,
    )


def add_jobseekers_routes(app: FastAPI, auth: Authentication) -> None:
    get_user_info = auth.get_user_info()
    requires = make_requires(get_user_info, get_role_repository, get_user_role_repository)

    router = CasbinAPIRouter(requires_factory=requires, prefix=_API_PREFIX, tags=["Jobseekers"])

    @router.get("/jobseekers", response_model=JobseekersResponse)
    @requires(Subject.JOBSEEKERS, Action.VIEW, resolves_scope=True)
    async def get_jobseekers(
        query: JobseekersQuery = Depends(_query),
        service: IJobseekersService = Depends(get_jobseekers_service),
        user_info: UserInfo = Depends(get_user_info),
        resolved: ResolvedScope = Depends(requires.dep(Subject.JOBSEEKERS, Action.VIEW, resolves_scope=True)),
    ) -> JobseekersResponse:
        try:
            return await service.get_jobseekers(query, AccessScope.from_resolved_scope(resolved), user_info.token)
        except JobseekersAccessDenied as exc:
            logger.info("Refused a roster request from user %s: %s", user_info.user_id, exc)
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail="Not allowed to view these jobseekers.") from exc

    @router.get("/jobseekers/{jobseeker_id}", response_model=JobseekerDetail)
    @requires(Subject.JOBSEEKERS, Action.VIEW, resolves_scope=True)
    async def get_jobseeker(
        jobseeker_id: str = Path(..., min_length=1),
        service: IJobseekersService = Depends(get_jobseekers_service),
        user_info: UserInfo = Depends(get_user_info),
        resolved: ResolvedScope = Depends(requires.dep(Subject.JOBSEEKERS, Action.VIEW, resolves_scope=True)),
    ) -> JobseekerDetail:
        try:
            detail = await service.get_jobseeker(jobseeker_id, AccessScope.from_resolved_scope(resolved), user_info.token)
        except JobseekersAccessDenied as exc:
            logger.info("Refused a profile request from user %s: %s", user_info.user_id, exc)
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail="Not allowed to view these jobseekers.") from exc

        if detail is None:
            raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="No such jobseeker.")
        return detail

    app.include_router(router)
