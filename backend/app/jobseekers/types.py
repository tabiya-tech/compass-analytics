from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

# ---- Vocabulary shared with the frontend ----

ModuleId = Literal["build-your-profile", "job-readiness", "career-explorer", "jobs"]
ModuleStatus = Literal["not_started", "in_progress", "completed"]
LoginMethod = Literal["google", "email"]
SortDirection = Literal["asc", "desc"]

# Module status columns filter rather than sort — "in progress" has no natural place in an ordering.
JobseekerSortKey = Literal["name", "profile_score_pct", "registered_at", "last_login_at"]

MODULE_IDS: tuple[ModuleId, ...] = ("build-your-profile", "job-readiness", "career-explorer", "jobs")


# ---- Access ----

class AccessScope(BaseModel):
    type: Literal["all", "institutions"]
    institution_ids: list[str] = Field(default_factory=list)

    model_config = {"extra": "forbid"}

    def covers(self, institution_id: str | None) -> bool:
        if self.type == "all":
            return True
        return institution_id is not None and institution_id in self.institution_ids


class JobseekerGrant(BaseModel):
    can_view: bool = False
    scope: AccessScope = AccessScope(type="institutions", institution_ids=[])

    model_config = {"extra": "forbid"}


# ---- Query ----

class JobseekersQuery(BaseModel):
    scope: AccessScope
    search: str | None = None
    # One entry per module being filtered; an empty list means "don't filter on this module".
    module_status: dict[ModuleId, list[ModuleStatus]] = Field(default_factory=dict)
    sort_by: JobseekerSortKey = "name"
    sort_direction: SortDirection = "asc"
    page: int = 1
    page_size: int = 50

    model_config = {"extra": "forbid"}


# ---- Roster ----

class JobseekerSummary(BaseModel):
    id: str
    name: str
    institution_id: str
    institution_name: str
    profile_score_pct: int = 0
    registered_at: date | None = None
    last_login_at: date | None = None
    module_status: dict[ModuleId, ModuleStatus] = Field(default_factory=dict)
    # False until Build Your Profile is completed — the skills list is empty while it is.
    skills_report_ready: bool = False
    skills: list[str] = Field(default_factory=list)


class RosterBatch(BaseModel):
    items: list[JobseekerSummary]
    total: int | None = None


class JobseekersResponse(BaseModel):
    items: list[JobseekerSummary]
    total: int
    page: int
    page_size: int


# ---- Profile drill-down ----

class JobseekerSubModuleProgress(BaseModel):
    """A step within Job Readiness, e.g. "CV Builder"."""

    id: str
    name: str
    status: ModuleStatus = "not_started"


class JobseekerModuleProgress(BaseModel):
    module_id: ModuleId
    status: ModuleStatus = "not_started"
    # Where inside Build Your Profile they stopped, e.g. "Skills". Absent for the other modules.
    phase: str | None = None
    # Job Readiness is the one module that breaks down into steps.
    sub_modules: list[JobseekerSubModuleProgress] | None = None


class JobseekerDemographics(BaseModel):
    gender: str | None = None
    age: int | None = None
    location: str | None = None
    education: str | None = None


class JobseekerLoginActivity(BaseModel):
    registered_at: date | None = None
    last_login_at: date | None = None
    total_logins: int = 0
    login_method: LoginMethod | None = None


class JobseekerOutputs(BaseModel):
    """What Build Your Profile produced for this jobseeker, and what they did with it."""

    skills_report_generated: bool = False
    downloaded: bool = False
    shared: bool = False


class JobseekerDetail(BaseModel):
    id: str
    name: str
    institution_id: str
    institution_name: str
    profile_score_pct: int = 0
    demographics: JobseekerDemographics = JobseekerDemographics()
    login_activity: JobseekerLoginActivity = JobseekerLoginActivity()
    modules: list[JobseekerModuleProgress] = Field(default_factory=list)
    outputs: JobseekerOutputs = JobseekerOutputs()
    skills: list[str] = Field(default_factory=list)
