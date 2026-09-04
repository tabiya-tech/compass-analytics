from app.roles.repository import IRoleRepository, IUserRoleRepository
from app.roles.types import RoleRecord, UserRoleRecord
from app.users.types import ALL_INSTITUTIONS, Action, Subject


_STUB_ROLE = RoleRecord(
    **{
        "_id": "000000000000000000000001",
        "name": "funder",
        "label": "Funder",
        "description": "Deployment-wide access.",
        "permissions": [
            {"subject": Subject.DASHBOARD, "action": Action.VIEW},
        ],
        "assignable": True,
    }
)

_STUB_USER_ROLE = UserRoleRecord(
    **{
        "_id": "000000000000000000000002",
        "user_id": "u1",
        "role_id": _STUB_ROLE.id,
        "institution_id": None,
        "granted_by": None,
        "granted_at": None,
    }
)


class FakeRoleRepository(IRoleRepository):
    """
    Test double that returns a single deployment-wide funder role.

    Use in route tests where authz should pass silently — the test subject
    is something else.
    """

    async def list_all(self) -> list[RoleRecord]:
        return [_STUB_ROLE]

    async def get_by_id(self, role_id: str) -> RoleRecord | None:
        return _STUB_ROLE if role_id == _STUB_ROLE.id else None

    async def get_by_name(self, name: str) -> RoleRecord | None:
        return _STUB_ROLE if name == _STUB_ROLE.name else None


class FakeUserRoleRepository(IUserRoleRepository):
    """
    Test double that grants every caller the stub funder role with wildcard access.

    Use in route tests where authz should pass silently.
    """

    async def list_all(self) -> list[UserRoleRecord]:
        return [_STUB_USER_ROLE]

    async def list_for_user(self, user_id: str) -> list[UserRoleRecord]:
        return [UserRoleRecord(**{**_STUB_USER_ROLE.model_dump(by_alias=True), "user_id": user_id})]

    async def list_for_users(self, user_ids: list[str]) -> list[UserRoleRecord]:
        return [UserRoleRecord(**{**_STUB_USER_ROLE.model_dump(by_alias=True), "user_id": uid}) for uid in user_ids]

    async def assign(self, user_id: str, role_id: str, institution_id: str | None, granted_by: str | None) -> UserRoleRecord:
        raise NotImplementedError

    async def revoke(self, user_role_id: str, user_id: str) -> bool:
        raise NotImplementedError

    async def revoke_all_for_user(self, user_id: str) -> None:
        raise NotImplementedError
