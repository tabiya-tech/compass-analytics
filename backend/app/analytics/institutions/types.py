from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class InstitutionSummary(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    institution_id: str
    institution_name: str
    registered_users: int = Field(ge=0)
    active_users_7d: int = Field(ge=0)
    skills_discovery_started_pct: Optional[float] = Field(default=None, ge=0)
    skills_discovery_completed_pct: Optional[float] = Field(default=None, ge=0)
    career_readiness_started_pct: Optional[float] = Field(default=None, ge=0)
    career_readiness_completed_pct: Optional[float] = Field(default=None, ge=0)
    career_explorer_started_pct: Optional[float] = Field(default=None, ge=0)


class InstitutionsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    institutions: list[InstitutionSummary]
