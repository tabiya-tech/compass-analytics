from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.users.types import Action, Subject


class PermissionEntry(BaseModel):
    subject: Subject
    action: Action

    model_config = {"extra": "forbid"}


class RoleRecord(BaseModel):
    id: str = Field(alias="_id")
    name: str
    label: str
    description: str
    permissions: list[PermissionEntry]
    assignable: bool
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None

    model_config = {"extra": "ignore", "populate_by_name": True}


class UserRoleRecord(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    role_id: str
    institution_id: Optional[str] = None
    granted_by: Optional[str] = None
    granted_at: Optional[datetime] = None

    model_config = {"extra": "ignore", "populate_by_name": True}


class UserRoleView(BaseModel):
    role_id: str
    role_name: str
    institution_id: Optional[str] = None
    granted_by: Optional[str] = None
    granted_at: Optional[datetime] = None

    model_config = {"extra": "forbid"}


class ManagedUser(BaseModel):
    user_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    roles: list[UserRoleView] = Field(default_factory=list)

    model_config = {"extra": "forbid"}


class AssignRoleRequest(BaseModel):
    role_id: str
    institution_id: Optional[str] = None

    model_config = {"extra": "forbid"}
