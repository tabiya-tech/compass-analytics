from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.users.types import Action, Subject


class GrantRecord(BaseModel):
    """
    A row in the `grants` collection: one (user, subject, action, institution)
    tuple. institution_id is a specific institution id, or ALL_INSTITUTIONS ("*")
    meaning every institution. A user's full access is the set of their grants.
    """

    grant_id: str
    user_id: str
    subject: Subject
    action: Action
    institution_id: str  # a specific institution id, or ALL_INSTITUTIONS
    granted_by: Optional[str] = None
    granted_at: Optional[datetime] = None

    model_config = {"extra": "ignore"}


class GrantView(BaseModel):
    """A single grant as returned to the access-management UI."""

    grant_id: str
    subject: Subject
    action: Action
    institution_id: str

    model_config = {"extra": "forbid"}


class ManagedUser(BaseModel):
    """A user plus their grants, for the User Access screen (GET /api/users)."""

    user_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    grants: list[GrantView] = Field(default_factory=list)

    model_config = {"extra": "forbid"}


class GrantRequest(BaseModel):
    """Body of POST /api/users/{user_id}/grants — grant one scoped permission."""

    subject: Subject
    action: Action
    institution_id: str  # a specific institution id, or ALL_INSTITUTIONS ("*")

    model_config = {"extra": "forbid"}


class RoleRequest(BaseModel):
    """Body of POST /api/users/{user_id}/roles — expand a named role to grants."""

    role: str  # must match a key in app.grants.roles.ROLES
    institution_id: str  # applied to every grant in the expanded role

    model_config = {"extra": "forbid"}
