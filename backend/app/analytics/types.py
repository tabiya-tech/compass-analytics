"""
Shared, cross-slice analytics types.

Slice-specific response models live in their own subpackage (e.g.
app/analytics/reach/types.py, app/analytics/modules/types.py). The filter params below are
reused by every slice that accepts the shared start_date/end_date/granularity/audience_segment/
login_method/institution_id query params.
"""
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict

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
