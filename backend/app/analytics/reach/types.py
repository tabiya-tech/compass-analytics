from pydantic import BaseModel, ConfigDict, Field

# The request contract (AnalyticsFilters and the filter vocabulary) is shared by every
# analytics endpoint and lives in app/analytics/types.py — it is deliberately not
# redefined here. Only reach's own response models belong in this module.

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
