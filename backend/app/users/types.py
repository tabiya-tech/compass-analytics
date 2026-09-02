from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Subject(str, Enum):
    """The resource a permission applies to."""

    DASHBOARD = "dashboard"
    INSTITUTIONS = "institutions"
    JOBSEEKERS = "jobseekers"
    ACCESS_MANAGEMENT = "access-management"
    ACCOUNT = "account"


class Action(str, Enum):
    """The operation being performed on a subject."""

    VIEW = "view"
    MANAGE = "manage"



class ScopeType(str, Enum):
    """
    How institution access is expressed when a caller's roles are resolved:

    - ALL: at least one role permission is deployment-scoped — the caller sees
      the whole deployment.
    - INSTITUTIONS: the caller is limited to the explicit institution_ids list.
    """

    ALL = "all"
    INSTITUTIONS = "institutions"


# Sentinel value used in Casbin policies for deployment-wide permissions.
ALL_INSTITUTIONS = "*"


class UserRecord(BaseModel):
    """
    A row in the `users` collection — holds a user's identity.
    Access control lives in the `roles` and `user_roles` collections.
    Active modules are a deployment-level setting read from ApplicationConfig, not stored per-user.
    """

    user_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    organization: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"extra": "ignore"}


class RegisterRequest(BaseModel):
    """
    Optional body for POST /users/register — the caller's own account details, as opposed to
    UserInfo's token-derived identity. A field left out here leaves whatever was saved for it untouched.
    """

    name: Optional[str] = None
    organization: Optional[str] = None

    model_config = {"extra": "forbid"}


class UserScope(BaseModel):
    type: ScopeType
    institution_ids: list[str] = Field(default_factory=list)

    model_config = {"extra": "forbid"}


class MeResponse(BaseModel):
    """
    The caller's own access, derived from their roles. The frontend gates
    purely on `permissions` (the "{subject}:{action}" strings) and `scope`.
    `role` is the name of the user's primary role, or null if unassigned.
    """

    user_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    organization: Optional[str] = None
    role: Optional[str] = None
    permissions: list[str] = Field(default_factory=list)
    scope: UserScope
    active_modules: list[str] = Field(default_factory=list)

    model_config = {"extra": "forbid"}
