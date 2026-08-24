from pydantic import BaseModel, ConfigDict, Field

# module_key values this backend has an analytics slice for.
SUPPORTED_MODULE_KEYS: frozenset[str] = frozenset({"build-your-profile"})


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
