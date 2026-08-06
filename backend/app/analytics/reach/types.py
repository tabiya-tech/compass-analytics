from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ---- Query filters ----

Granularity = Literal["day", "week", "month"]
AudienceSegment = Literal["youth", "women", "rural", "first-time-jobseeker"]
LoginMethod = Literal["email", "google", "anonymous"]


class AnalyticsFilters(BaseModel):
    start_date: date
    end_date: date
    granularity: Granularity
    audience_segment: AudienceSegment | None = None
    login_method: LoginMethod | None = None
    institution_id: str | None = None  # None = all institutions in the caller's scope

    model_config = ConfigDict(extra="forbid")


# ---- Reach response ----
#
# These models parse JSON from the Compass upstream. extra="forbid" makes schema
# drift (a renamed/added upstream field) fail loudly at the boundary rather than
# being silently dropped; frozen makes the response DTOs immutable once built.
# Counts and rates are non-negative by domain, enforced with Field(ge=0).


class ReachSummary(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    total_users: int = Field(ge=0)
    active_users_30d: int = Field(ge=0)
    total_logins: int = Field(ge=0)
    avg_logins_per_user: float = Field(ge=0)
    avg_session_minutes: float = Field(ge=0)


class TimeSeriesPoint(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    label: str
    cumulative: int = Field(ge=0)
    added: int = Field(ge=0)
    new_users: int = Field(ge=0)
    returning: int = Field(ge=0)
    logins: int = Field(ge=0)


class ReachResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    summary: ReachSummary
    series: list[TimeSeriesPoint]
