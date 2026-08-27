from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# module_key values this backend has an analytics slice for.
SUPPORTED_MODULE_KEYS: frozenset[str] = frozenset({"build-your-profile", "job-readiness", "career-explorer", "jobs"})

MODULE_KEY_JOB_READINESS: Literal["job-readiness"] = "job-readiness"
MODULE_KEY_CAREER_EXPLORER: Literal["career-explorer"] = "career-explorer"
MODULE_KEY_JOBS: Literal["jobs"] = "jobs"

# Upstream path for each module_key — add entries here as new keys are supported.
UPSTREAM_PATH: dict[str, str] = {
    "build-your-profile": "/analytics/modules/build-your-profile",
    MODULE_KEY_JOB_READINESS: "/analytics/modules/job-readiness",
    MODULE_KEY_CAREER_EXPLORER: "/analytics/modules/career-explorer",
    MODULE_KEY_JOBS: "/analytics/modules/jobs",
}


class BuildYourProfileSummary(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    started_users: int = Field(ge=0)
    started_percentage: float = Field(ge=0)
    completed_users: int = Field(ge=0)
    avg_completion_minutes: float = Field(ge=0)


class BuildYourProfileSeriesPoint(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    label: str
    started: int = Field(ge=0)
    completed: int = Field(ge=0)
    skills_reports_generated: int = Field(ge=0)
    skills_reports_downloaded: int = Field(ge=0)


class ConversationPhaseReach(BaseModel):
    """One funnel stage: how many distinct users reached at least this far in the conversation."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str
    reached: int = Field(ge=0)


class CompassBuildYourProfilePayload(BaseModel):
    """Raw shape returned by the upstream call — no `degraded` field, that's added locally."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    summary: BuildYourProfileSummary
    series: list[BuildYourProfileSeriesPoint]
    phases: list[ConversationPhaseReach]


class BuildYourProfileResponse(BaseModel):
    """The response actually returned to the frontend."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    summary: BuildYourProfileSummary
    series: list[BuildYourProfileSeriesPoint]
    phases: list[ConversationPhaseReach]
    degraded: bool


class SubModuleProgress(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str
    name: str
    started: int = Field(ge=0)
    completed: int = Field(ge=0)


class JobReadinessResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    started_percentage: float = Field(ge=0)
    sub_modules: list[SubModuleProgress]
    degraded: bool = False


class CareerExplorerSector(BaseModel):
    """One sector people asked about. `is_priority` marks the sectors the deployment is steering towards."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    sector_name: str
    is_priority: bool = False
    unique_users: int = Field(default=0, ge=0)
    total_inquiries: int = Field(default=0, ge=0)


class CountPercentage(BaseModel):
    """Upstream reports a count alongside its share — see compass-connect `career_explorer/types.py`."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    count: int = Field(ge=0)
    percentage: float = Field(ge=0)


class CareerExplorerSummary(BaseModel):
    """Flattened for the frontend, which reads every module's headline figures off a `summary`."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    total_registered_students: int = Field(default=0, ge=0)
    started_users: int = Field(default=0, ge=0)
    started_percentage: float = Field(default=0.0, ge=0)
    #: Came back for a second sector inquiry or more — the module's retention signal.
    returned_users: int = Field(default=0, ge=0)
    #: `returned_users` as a share of those who started, not of everyone registered.
    returned_percentage: float = Field(default=0.0, ge=0)
    priority_sector_users: int = Field(default=0, ge=0)
    non_priority_sector_users: int = Field(default=0, ge=0)


class CompassCareerExplorerPayload(BaseModel):
    """
    Raw shape returned by the upstream call — mirrors compass-connect's `CareerExplorerStatsResponse`
    one-for-one, so schema drift upstream fails validation loudly here rather than half-parsing.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    total_registered_students: int = Field(ge=0)
    started: CountPercentage
    returned_2_plus: CountPercentage
    priority_sector_users: int = Field(ge=0)
    non_priority_sector_users: int = Field(ge=0)
    top_sectors: list[CareerExplorerSector] = Field(default_factory=list)

    def to_summary(self) -> CareerExplorerSummary:
        return CareerExplorerSummary(
            total_registered_students=self.total_registered_students,
            started_users=self.started.count,
            started_percentage=self.started.percentage,
            returned_users=self.returned_2_plus.count,
            returned_percentage=self.returned_2_plus.percentage,
            priority_sector_users=self.priority_sector_users,
            non_priority_sector_users=self.non_priority_sector_users,
        )


class CareerExplorerResponse(BaseModel):
    """The response actually returned to the frontend."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    summary: CareerExplorerSummary
    top_sectors: list[CareerExplorerSector]
    degraded: bool


class JobsSummary(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    jobs_sourced: int = Field(ge=0)
    # Not tracked upstream yet — defaults so a jobs_sourced-only payload still validates.
    profiles_with_matches: int = Field(default=0, ge=0)
    profiles_with_matches_percentage: float = Field(default=0.0, ge=0)
    jobs_viewed_per_user: float = Field(default=0.0, ge=0)


class CompassJobsPayload(BaseModel):
    """Raw shape returned by the upstream call — no `degraded` field, that's added locally."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    summary: JobsSummary


class JobsResponse(BaseModel):
    """The response actually returned to the frontend."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    summary: JobsSummary
    degraded: bool


ModulesResponse = BuildYourProfileResponse | JobReadinessResponse | CareerExplorerResponse | JobsResponse
