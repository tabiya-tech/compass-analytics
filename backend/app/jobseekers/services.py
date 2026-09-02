import logging
from abc import ABC, abstractmethod
from datetime import date

from app.jobseekers.repositories import IJobseekersRepository
from app.jobseekers.types import (
    AccessScope,
    JobseekerDetail,
    JobseekerSortKey,
    JobseekerSummary,
    JobseekersQuery,
    JobseekersResponse,
)

logger = logging.getLogger(__name__)


class JobseekersAccessDenied(Exception):
    """The caller asked for jobseekers their grant does not cover."""


def _narrow(requested: AccessScope, granted: AccessScope) -> AccessScope:
    if granted.type == "all":
        return requested if requested.type == "institutions" else granted

    if requested.type == "all":
        # "Everything I'm allowed" — the grant itself is the answer.
        return granted

    outside = [
        institution_id for institution_id in requested.institution_ids if institution_id not in granted.institution_ids
    ]
    if outside:
        raise JobseekersAccessDenied(f"Institutions outside the caller's grant: {', '.join(sorted(outside))}")

    return AccessScope(type="institutions", institution_ids=list(requested.institution_ids))


def _matches_search(jobseeker: JobseekerSummary, search: str) -> bool:
    return search in jobseeker.name.lower() or search in jobseeker.id.lower()


def _sort_value(jobseeker: JobseekerSummary, key: JobseekerSortKey) -> tuple[int, object]:
    if key == "profile_score_pct":
        return (0, jobseeker.profile_score_pct)
    if key in ("registered_at", "last_login_at"):
        value: date | None = getattr(jobseeker, key)
        return (1, date.min) if value is None else (0, value)
    return (0, jobseeker.name.lower())


class IJobseekersService(ABC):
    @abstractmethod
    async def get_jobseekers(
        self, query: JobseekersQuery, granted_scope: AccessScope, token: str
    ) -> JobseekersResponse: ...

    @abstractmethod
    async def get_jobseeker(
        self, jobseeker_id: str, granted_scope: AccessScope, token: str
    ) -> JobseekerDetail | None: ...


class JobseekersService(IJobseekersService):
    def __init__(self, repository: IJobseekersRepository):
        self._repo = repository

    async def get_jobseekers(self, query: JobseekersQuery, granted_scope: AccessScope, token: str) -> JobseekersResponse:
        scope = _narrow(query.scope, granted_scope)
        # Reading stops as soon as the requested page has been reached: rows before it are read
        # only because a cursor cannot be jumped, and rows after it are never read at all.
        wanted = query.page * query.page_size

        rows: list[JobseekerSummary] = []
        roster_size: int | None = None
        # Set if the upstream ever answered wider than it was asked: its count then describes
        # jobseekers this caller may not see, so it cannot be reported as the roster's size.
        overreached = False

        async for batch in self._repo.iter_roster(scope, token, page_size=query.page_size):
            if batch.total is not None:
                roster_size = batch.total
            in_scope = self._in_scope(batch.items, scope)
            overreached = overreached or len(in_scope) != len(batch.items)
            rows.extend(in_scope)
            if len(rows) >= wanted:
                break

        start = (query.page - 1) * query.page_size
        page = self._apply_filters(rows[start : start + query.page_size], query)
        page.sort(key=lambda jobseeker: _sort_value(jobseeker, query.sort_by), reverse=query.sort_direction == "desc")

        counted_roster = roster_size is not None and not self._is_filtered(query) and not overreached
        return JobseekersResponse(
            items=page,
            # The roster's size when that is known and describes the same set the rows came from;
            # otherwise the number of rows this page carries, so the count matches what is shown.
            total=roster_size if counted_roster else len(page),
            page=query.page,
            page_size=query.page_size,
        )

    @staticmethod
    def _is_filtered(query: JobseekersQuery) -> bool:
        return bool((query.search or "").strip()) or any(query.module_status.values())

    @staticmethod
    def _in_scope(roster: list[JobseekerSummary], scope: AccessScope) -> list[JobseekerSummary]:
        in_scope = [jobseeker for jobseeker in roster if scope.covers(jobseeker.institution_id)]
        if len(in_scope) != len(roster):
            logger.warning(
                "The Compass API returned %d jobseeker(s) outside the requested scope; they were dropped.",
                len(roster) - len(in_scope),
            )
        return in_scope

    @staticmethod
    def _apply_filters(roster: list[JobseekerSummary], query: JobseekersQuery) -> list[JobseekerSummary]:
        search = (query.search or "").strip().lower()
        filters = {module_id: statuses for module_id, statuses in query.module_status.items() if statuses}

        return [
            jobseeker
            for jobseeker in roster
            if (not search or _matches_search(jobseeker, search))
            and all(
                jobseeker.module_status.get(module_id, "not_started") in statuses
                for module_id, statuses in filters.items()
            )
        ]

    async def get_jobseeker(self, jobseeker_id: str, granted_scope: AccessScope, token: str) -> JobseekerDetail | None:
        detail = await self._repo.get_jobseeker(jobseeker_id, granted_scope, token)
        if detail is None:
            return None

        # Out of scope reads as "no such jobseeker", not "not allowed": telling a caller that an id
        # exists at an institution they cannot see is itself a disclosure.
        if not granted_scope.covers(detail.institution_id):
            logger.info("Jobseeker %s is outside the caller's scope; reporting it as not found.", jobseeker_id)
            return None

        return detail
