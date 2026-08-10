from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

# ---- Domain enums ----


class UserRole(str, Enum):
    """
    Who the caller is, which determines what they can see:

    - IMPLEMENTER: an organization running Compass at a single institution;
      always scoped to their own institution.
    - FUNDER: a program manager overseeing a portfolio of institutions within
      one national deployment; sees the aggregate and can drill into any one of
      their institutions.
    """

    IMPLEMENTER = "implementer"
    FUNDER = "funder"


class ScopeType(str, Enum):
    """
    How institution access is expressed on a user record:

    - ALL: the caller may see every institution in the deployment (a funder
      overseeing the whole national programme).
    - INSTITUTIONS: the caller is limited to the explicit institution_ids list.
    """

    ALL = "all"
    INSTITUTIONS = "institutions"


ActiveModule = str  # "build-your-profile" | "job-readiness" | "career-explorer" | "jobs"


# ---- Mongo document model ----


class UserRecord(BaseModel):
    """
    A row in the `users` collection — the authoritative source for a caller's
    role and institution scope. The Firebase JWT tells us *who* is calling
    (user_id); this record tells us *what* they're allowed to see.
    """

    user_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    role: UserRole
    scope_type: ScopeType
    institution_ids: list[str] = Field(default_factory=list)
    active_modules: list[ActiveModule] = Field(default_factory=list)
    created_at: Optional[datetime] = None

    model_config = {"extra": "ignore"}


# ---- API response model (GET /api/me) ----


class UserScope(BaseModel):
    type: ScopeType
    institution_ids: list[str] = Field(default_factory=list)

    model_config = {"extra": "forbid"}


class MeResponse(BaseModel):
    user_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    role: UserRole
    scope: UserScope
    active_modules: list[ActiveModule] = Field(default_factory=list)

    model_config = {"extra": "forbid"}
