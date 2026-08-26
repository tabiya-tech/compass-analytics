import logging
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from datetime import date, datetime
from typing import Any

from app.jobseekers.institution_ids import decode_institution_id, encode_institution_id
from app.jobseekers.types import (
    MODULE_IDS,
    AccessScope,
    JobseekerDemographics,
    JobseekerDetail,
    JobseekerLoginActivity,
    JobseekerModuleProgress,
    JobseekerOutputs,
    JobseekerSummary,
    ModuleId,
    ModuleStatus,
    RosterBatch,
)
from common_libs.http_client.base import AsyncHttpClient, HttpClientError

logger = logging.getLogger(__name__)

_STUDENTS_PATH = "/analytics/jobseekers"

#: Compass's own cap on `/students/analytics`.
_PAGE_LIMIT = 100

#: A runaway-cursor backstop, not a product limit: 50 pages is 5,000 jobseekers.
_MAX_PAGES = 50

#: Job Readiness is finished when every one of its modules has been passed.
_JOB_READINESS_MODULE_COUNT = 6

_VALID_STATUSES: tuple[ModuleStatus, ...] = ("not_started", "in_progress", "completed")


class IJobseekersRepository(ABC):
    @abstractmethod
    def iter_roster(self, scope: AccessScope, token: str, *, page_size: int) -> AsyncIterator[RosterBatch]:
        ...

    @abstractmethod
    async def get_jobseeker(self, jobseeker_id: str, scope: AccessScope, token: str) -> JobseekerDetail | None: ...


def _as_date(value: Any) -> date | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()
    except ValueError:
        logger.warning("Ignoring an unparseable date from the Compass API: %r", value)
        return None


def _as_int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _build_your_profile_status(raw: dict) -> ModuleStatus:
    status = raw.get("skills_discovery_status")
    return status if status in _VALID_STATUSES else "not_started"


def _job_readiness_status(raw: dict) -> ModuleStatus:
    if _as_int(raw.get("career_readiness_modules_explored")) >= _JOB_READINESS_MODULE_COUNT:
        return "completed"
    return "in_progress" if _as_int(raw.get("modules_explored")) > 0 else "not_started"


def _career_explorer_status(raw: dict) -> ModuleStatus:
    return "in_progress" if _as_int(raw.get("career_explorer_messages_sent")) > 0 else "not_started"


def _module_status(raw: dict) -> dict[ModuleId, ModuleStatus]:
    return {
        "build-your-profile": _build_your_profile_status(raw),
        "job-readiness": _job_readiness_status(raw),
        "career-explorer": _career_explorer_status(raw),
        # Compass reports nothing per-jobseeker about Jobs yet. The roster hides this column
        # anyway; the profile shows it as not started until there is a signal to report.
        "jobs": "not_started",
    }


def _profile_score_pct(statuses: dict[ModuleId, ModuleStatus]) -> int:
    return {"completed": 100, "in_progress": 50, "not_started": 0}[statuses["build-your-profile"]]


def _as_summary(raw: dict) -> JobseekerSummary | None:
    jobseeker_id = raw.get("id")
    name = raw.get("name")
    if not jobseeker_id or not name:
        logger.warning("Skipping a Compass student record with no id or no name.")
        return None

    institution_name = str(raw.get("institution") or "")
    statuses = _module_status(raw)
    # The Skills Report is a Build Your Profile output — there is nothing to show until it is done.
    report_ready = statuses["build-your-profile"] == "completed"

    return JobseekerSummary(
        id=str(jobseeker_id),
        name=str(name),
        institution_id=encode_institution_id(institution_name) if institution_name else "",
        institution_name=institution_name,
        profile_score_pct=_profile_score_pct(statuses),
        # Compass does not report a registration date on `/students`; the frontend shows a dash.
        registered_at=None,
        last_login_at=_as_date(raw.get("last_login")),
        module_status=statuses,
        skills_report_ready=report_ready,
        # `/students` does not carry the elicited skills at all, so the report is offered as
        # ready or not, and never with a count that would be a guess.
        skills=[],
    )


def _as_detail(summary: JobseekerSummary, raw: dict) -> JobseekerDetail:
    return JobseekerDetail(
        id=summary.id,
        name=summary.name,
        institution_id=summary.institution_id,
        institution_name=summary.institution_name,
        profile_score_pct=summary.profile_score_pct,
        demographics=JobseekerDemographics(
            gender=raw.get("gender"),
            # Compass reports a year of study rather than an age.
            age=None,
            location=raw.get("province"),
            education=raw.get("qualification_type") or raw.get("year"),
        ),
        login_activity=JobseekerLoginActivity(
            registered_at=summary.registered_at,
            last_login_at=summary.last_login_at,
            # `/students/analytics` reports neither a login count nor a login method.
            total_logins=0,
            login_method=None,
        ),
        modules=[
            JobseekerModuleProgress(
                module_id=module_id,
                status=summary.module_status[module_id],
                # `/students/analytics` reports no Build Your Profile phase and no per-step Job
                # Readiness breakdown, so neither is invented here — the frontend falls back to
                # the module's own status.
            )
            for module_id in MODULE_IDS
        ],
        outputs=JobseekerOutputs(
            skills_report_generated=summary.skills_report_ready,
            # Whether a report was downloaded or shared is not tracked upstream yet.
            downloaded=False,
            shared=False,
        ),
        skills=summary.skills,
    )


class CompassStudentsRepository(IJobseekersRepository):
    def __init__(self, http_client: AsyncHttpClient):
        self._client = http_client

    async def _get(self, path: str, token: str, params: dict | None = None) -> Any:
        try:
            return await self._client.get(path, params=params, headers={"Authorization": f"Bearer {token}"})
        except HttpClientError as exc:
            logger.warning("Compass API request to %s failed (%s): %s", path, exc.status_code, exc)
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Compass API request to %s errored: %s", path, exc)
        return None

    async def _fetch_page(
        self, institution_name: str | None, token: str, cursor: str | None, limit: int, want_total: bool
    ) -> tuple[list[dict], str | None, int | None] | None:
        params: dict = {"limit": limit}
        if institution_name:
            params["institution"] = institution_name
        if cursor:
            params["cursor"] = cursor
        if want_total:
            params["include"] = "count"

        # `search` is deliberately not passed: on Compass it matches institution, programme and
        # year, while this service's search matches a jobseeker's name or id. Sending it would
        # silently answer a different question.
        page = await self._get(_STUDENTS_PATH, token, params=params)
        if not page:
            return None

        meta = page.get("meta") or {}
        records = [raw for raw in (page.get("data") or []) if isinstance(raw, dict)]
        next_cursor = meta.get("next_cursor") if meta.get("has_more") else None
        total = meta.get("total")
        return records, next_cursor, total if isinstance(total, int) else None

    async def _count(self, institution_name: str | None, token: str) -> int:
        page = await self._fetch_page(institution_name, token, None, 1, want_total=True)
        return (page[2] or 0) if page else 0

    def _institution_names(self, scope: AccessScope) -> list[str | None]:
        if scope.type == "all":
            return [None]

        names: list[str | None] = []
        for institution_id in scope.institution_ids:
            institution_name = decode_institution_id(institution_id)
            if not institution_name:
                # An id this service did not mint names no institution it can ask about. Asking
                # without a name would return every institution, so the id is skipped instead.
                continue
            names.append(institution_name)
        return names

    async def _iter_pages(
        self, scope: AccessScope, token: str, page_size: int
    ) -> AsyncIterator[tuple[list[dict], int | None]]:
        institution_names = self._institution_names(scope)
        # One upstream page per page asked for, up to Compass's own cap: a page_size of 100 — what
        # the roster screen asks for — is exactly one read, and a larger one is read in 100s.
        limit = max(1, min(page_size, _PAGE_LIMIT))

        # A single walk is told its own size for free, alongside its first page. Several walks are
        # counted upfront instead: a caller that stops inside the first institution would otherwise
        # be told a total that leaves the others out.
        total: int | None = None
        counted = False
        if len(institution_names) > 1:
            total = sum([await self._count(institution_name, token) for institution_name in institution_names])
            counted = True

        for institution_name in institution_names:
            cursor: str | None = None
            for page_number in range(_MAX_PAGES):
                want_total = not counted and page_number == 0
                page = await self._fetch_page(institution_name, token, cursor, limit, want_total)
                if page is None:
                    # The upstream is unavailable: stop rather than serve a roster with a hole in it.
                    return

                records, cursor, page_total = page
                if want_total:
                    total, counted = page_total, True

                yield records, total
                # Reported once — a caller sums nothing, and a later page cannot contradict it.
                total = None

                if not cursor:
                    break
            else:
                logger.warning(
                    "Stopped paging Compass students after %d pages; the roster may be incomplete.", _MAX_PAGES
                )

    def iter_roster(self, scope: AccessScope, token: str, *, page_size: int) -> AsyncIterator[RosterBatch]:
        async def batches() -> AsyncIterator[RosterBatch]:
            async for records, total in self._iter_pages(scope, token, page_size):
                summaries = (_as_summary(raw) for raw in records)
                yield RosterBatch(items=[summary for summary in summaries if summary is not None], total=total)

        return batches()

    async def get_jobseeker(self, jobseeker_id: str, scope: AccessScope, token: str) -> JobseekerDetail | None:
        async for records, _ in self._iter_pages(scope, token, _PAGE_LIMIT):
            for raw in records:
                summary = _as_summary(raw)
                if summary is not None and summary.id == jobseeker_id:
                    return _as_detail(summary, raw)
        return None
