from datetime import date
from typing import Literal

from pydantic import BaseModel

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

    model_config = {"extra": "forbid"}


# ---- Reach ----

class ReachSummary(BaseModel):
    total_users: int
    active_users_30d: int
    total_logins: int
    avg_logins_per_user: float
    avg_session_minutes: int


class TimeSeriesPoint(BaseModel):
    label: str
    cumulative: int
    added: int
    new_users: int
    returning: int
    logins: int


class ReachResponse(BaseModel):
    summary: ReachSummary
    series: list[TimeSeriesPoint]
