from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

# ── Compass upstream shape (from /analytics/institutions/summary) ─────────────

class CompassInstitutionSummary(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)

    institution_id: str
    institution_name: str
    registered_users: int = Field(ge=0)
    active_users_7d: int = Field(ge=0)
    skills_discovery_started_pct: Optional[float] = Field(default=None, ge=0)
    skills_discovery_completed_pct: Optional[float] = Field(default=None, ge=0)
    career_readiness_started_pct: Optional[float] = Field(default=None, ge=0)
    career_readiness_completed_pct: Optional[float] = Field(default=None, ge=0)
    career_explorer_started_pct: Optional[float] = Field(default=None, ge=0)


class CompassInstitutionsResponse(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)

    institutions: list[CompassInstitutionSummary]


# ── API response shapes (what this service exposes to the frontend) ───────────

class InstitutionItem(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str
    name: str
    region: str = ""
    registered_users: int = Field(ge=0)
    active_users: int = Field(ge=0)
    module_started_pct: dict[str, float]
    skills_reports: Optional[int] = None


class InstitutionsTotals(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    jobseekers_reached: int = Field(ge=0)
    skills_reports: int = Field(ge=0)
    institutions: int = Field(ge=0)


class InstitutionsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    items: list[InstitutionItem]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    totals: InstitutionsTotals
    available_regions: list[str]


# ── Institution detail (drill-down modal) ────────────────────────────────────

class InstitutionReach(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    registered_users: int = Field(ge=0)
    active_users_30d: int = Field(ge=0)
    top_age_band: str = "—"
    largest_group: str = "—"
    most_common_education: str = "—"


class InstitutionLoginActivity(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    avg_logins_per_user: float = 0.0
    total_logins: int = 0
    avg_session_minutes: float = 0.0
    google_login_pct: float = 0.0
    email_login_pct: float = 0.0


class InstitutionModuleProgress(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    module_id: str
    started_pct: float
    highlight_value: Optional[float] = None


class InstitutionDetail(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str
    name: str
    city: str = "—"
    region: str = ""
    lead_pm: str = "—"
    profile_score_pct: Optional[float] = None
    reach: InstitutionReach
    login_activity: InstitutionLoginActivity
    modules: list[InstitutionModuleProgress]
    outputs: None = None
