"""
Unit tests for UserService.

Fake repositories stand in for MongoDB. DB round-trips are covered by the
route integration tests in routes_test.py.
"""
import pytest

from app.auth.firebase import SignInProvider, UserInfo
from app.roles.repository import IRoleRepository, IUserRoleRepository
from app.roles.types import AssignRoleRequest, PermissionEntry, RoleRecord, UserRoleRecord
from app.users.repository import IUserRepository
from app.users.errors import ForbiddenInstitutionError, UserNotProvisionedError
from app.users.service import UserService
from app.users.types import Action, RegisterRequest, ScopeType, Subject, UserRecord


def _make_role(role_id: str, name: str, permissions: list[PermissionEntry], assignable: bool = True) -> RoleRecord:
    return RoleRecord(**{
        "_id": role_id,
        "name": name,
        "label": name.capitalize(),
        "description": "",
        "permissions": [p.model_dump() for p in permissions],
        "assignable": assignable,
    })


def _make_permission(subject: Subject, action: Action) -> PermissionEntry:
    return PermissionEntry(subject=subject, action=action)


_FUNDER_ROLE = _make_role(
    "role-funder",
    "funder",
    [
        _make_permission(Subject.DASHBOARD, Action.VIEW),
        _make_permission(Subject.INSTITUTIONS, Action.VIEW),
        _make_permission(Subject.ACCESS_MANAGEMENT, Action.MANAGE),
        _make_permission(Subject.ACCOUNT, Action.VIEW),
    ],
)

_IMPLEMENTER_ROLE = _make_role(
    "role-impl",
    "implementer",
    [
        _make_permission(Subject.DASHBOARD, Action.VIEW),
        _make_permission(Subject.JOBSEEKERS, Action.VIEW),
        _make_permission(Subject.ACCOUNT, Action.VIEW),
    ],
)


class _FakeUserRepository(IUserRepository):
    def __init__(self, records: list[UserRecord]):
        self._records = {r.user_id: r for r in records}

    async def get_by_user_id(self, user_id: str) -> UserRecord | None:
        return self._records.get(user_id)

    async def list_all(self) -> list[UserRecord]:
        return list(self._records.values())

    async def upsert(self, record: UserRecord) -> UserRecord:
        self._records[record.user_id] = record
        return record


class _FakeRoleRepository(IRoleRepository):
    def __init__(self, roles: list[RoleRecord]):
        self._roles = {r.id: r for r in roles}

    async def list_all(self) -> list[RoleRecord]:
        return list(self._roles.values())

    async def get_by_id(self, role_id: str) -> RoleRecord | None:
        return self._roles.get(role_id)

    async def get_by_name(self, name: str) -> RoleRecord | None:
        return next((r for r in self._roles.values() if r.name == name), None)


class _FakeUserRoleRepository(IUserRoleRepository):
    def __init__(self, user_roles: list[UserRoleRecord] | None = None):
        self._user_roles: list[UserRoleRecord] = user_roles or []
        self._next_id = 0

    def _new_id(self) -> str:
        self._next_id += 1
        return f"ur-{self._next_id}"

    async def list_all(self) -> list[UserRoleRecord]:
        return list(self._user_roles)

    async def list_for_user(self, user_id: str) -> list[UserRoleRecord]:
        return [ur for ur in self._user_roles if ur.user_id == user_id]

    async def list_for_users(self, user_ids: list[str]) -> list[UserRoleRecord]:
        return [ur for ur in self._user_roles if ur.user_id in user_ids]

    async def assign(self, user_id: str, role_id: str, institution_id: str | None, granted_by: str | None) -> UserRoleRecord:
        existing = next(
            (ur for ur in self._user_roles if ur.user_id == user_id and ur.role_id == role_id and ur.institution_id == institution_id),
            None,
        )
        if existing:
            return existing
        record = UserRoleRecord(**{
            "_id": self._new_id(),
            "user_id": user_id,
            "role_id": role_id,
            "institution_id": institution_id,
            "granted_by": granted_by,
            "granted_at": None,
        })
        self._user_roles.append(record)
        return record

    async def revoke(self, user_role_id: str) -> bool:
        before = len(self._user_roles)
        self._user_roles = [ur for ur in self._user_roles if ur.id != user_role_id]
        return len(self._user_roles) < before

    async def revoke_all_for_user(self, user_id: str) -> None:
        self._user_roles = [ur for ur in self._user_roles if ur.user_id != user_id]


def _make_user_info(user_id: str = "u1") -> UserInfo:
    return UserInfo(
        user_id=user_id,
        name="Test User",
        email="user@example.com",
        token="tok",  # nosec B106
        sign_in_provider=SignInProvider.PASSWORD,
    )


def _make_user_record(user_id: str = "u1") -> UserRecord:
    return UserRecord(user_id=user_id, email=f"{user_id}@example.com", name="Test User")


def _make_user_role(user_id: str, role: RoleRecord, institution_id: str | None = None, ur_id: str = "ur-1") -> UserRoleRecord:
    return UserRoleRecord(**{
        "_id": ur_id,
        "user_id": user_id,
        "role_id": role.id,
        "institution_id": institution_id,
        "granted_by": None,
        "granted_at": None,
    })


async def _make_service(
    records: list[UserRecord] | None = None,
    roles: list[RoleRecord] | None = None,
    user_roles: list[UserRoleRecord] | None = None,
) -> tuple[UserService, _FakeUserRoleRepository]:
    role_repo = _FakeRoleRepository(roles or [_FUNDER_ROLE, _IMPLEMENTER_ROLE])
    user_role_repo = _FakeUserRoleRepository(user_roles or [])
    svc = UserService(
        repository=_FakeUserRepository(records or []),
        role_repository=role_repo,
        user_role_repository=user_role_repo,
    )
    return svc, user_role_repo


@pytest.mark.usefixtures("setup_application_config")
class TestGetMe:
    async def test_returns_permissions_derived_from_role(self):
        # GIVEN a user assigned the funder role
        ur = _make_user_role("u1", _FUNDER_ROLE)
        svc, _ = await _make_service(records=[_make_user_record()], user_roles=[ur])

        result = await svc.get_me(_make_user_info())

        assert "dashboard:view" in result.permissions
        assert "access-management:manage" in result.permissions

    async def test_returns_all_scope_for_deployment_scoped_role(self):
        ur = _make_user_role("u1", _FUNDER_ROLE)
        svc, _ = await _make_service(records=[_make_user_record()], user_roles=[ur])

        result = await svc.get_me(_make_user_info())

        assert result.scope.type == ScopeType.ALL

    async def test_returns_institutions_scope_for_institution_scoped_role(self):
        ur = _make_user_role("u1", _IMPLEMENTER_ROLE, institution_id="inst-a")
        svc, _ = await _make_service(records=[_make_user_record()], user_roles=[ur])

        result = await svc.get_me(_make_user_info())

        assert result.scope.type == ScopeType.INSTITUTIONS
        assert result.scope.institution_ids == ["inst-a"]

    async def test_returns_role_name(self):
        ur = _make_user_role("u1", _FUNDER_ROLE)
        svc, _ = await _make_service(records=[_make_user_record()], user_roles=[ur])

        result = await svc.get_me(_make_user_info())

        assert result.role == "funder"

    async def test_returns_null_role_when_no_roles_assigned(self):
        svc, _ = await _make_service(records=[_make_user_record()])

        result = await svc.get_me(_make_user_info())

        assert result.role is None

    async def test_prefers_jwt_identity_over_stored_copy(self):
        record = UserRecord(user_id="u1", email="stale@example.com", name="Stale")
        svc, _ = await _make_service(records=[record])

        result = await svc.get_me(_make_user_info())

        assert result.email == "user@example.com"
        assert result.name == "Test User"

    async def test_raises_not_provisioned_when_no_record(self):
        svc, _ = await _make_service()
        with pytest.raises(UserNotProvisionedError):
            await svc.get_me(_make_user_info())

    async def test_returns_organization_recorded_at_registration(self):
        record = UserRecord(user_id="u1", email="user@example.com", name="Test User", organization="Acme Corp")
        svc, _ = await _make_service(records=[record])

        result = await svc.get_me(_make_user_info())

        assert result.organization == "Acme Corp"


class TestResolveScope:
    async def test_deployment_role_with_no_drilldown_returns_none_filter(self):
        ur = _make_user_role("u1", _FUNDER_ROLE)
        svc, _ = await _make_service(records=[_make_user_record()], user_roles=[ur])

        result = await svc.resolve_scope(_make_user_info(), None)

        assert result.institution_ids is None

    async def test_deployment_role_drilldown_passes_through_institution(self):
        ur = _make_user_role("u1", _FUNDER_ROLE)
        svc, _ = await _make_service(records=[_make_user_record()], user_roles=[ur])

        result = await svc.resolve_scope(_make_user_info(), "inst-a")

        assert result.institution_ids == ["inst-a"]

    async def test_institution_scoped_role_with_no_drilldown_returns_assigned_institutions(self):
        ur_a = _make_user_role("u1", _IMPLEMENTER_ROLE, institution_id="inst-a", ur_id="ur-1")
        ur_b = _make_user_role("u1", _IMPLEMENTER_ROLE, institution_id="inst-b", ur_id="ur-2")
        svc, _ = await _make_service(records=[_make_user_record()], user_roles=[ur_a, ur_b])

        result = await svc.resolve_scope(_make_user_info(), None)

        assert sorted(result.institution_ids) == ["inst-a", "inst-b"]

    async def test_institution_scoped_drilldown_into_own_institution(self):
        ur = _make_user_role("u1", _IMPLEMENTER_ROLE, institution_id="inst-a")
        svc, _ = await _make_service(records=[_make_user_record()], user_roles=[ur])

        result = await svc.resolve_scope(_make_user_info(), "inst-a")

        assert result.institution_ids == ["inst-a"]

    async def test_institution_scoped_drilldown_into_foreign_institution_raises(self):
        ur = _make_user_role("u1", _IMPLEMENTER_ROLE, institution_id="inst-a")
        svc, _ = await _make_service(records=[_make_user_record()], user_roles=[ur])

        with pytest.raises(ForbiddenInstitutionError):
            await svc.resolve_scope(_make_user_info(), "inst-x")

    async def test_raises_not_provisioned_when_no_record(self):
        svc, _ = await _make_service()
        with pytest.raises(UserNotProvisionedError):
            await svc.resolve_scope(_make_user_info(), None)


class TestListManagedUsers:
    async def test_returns_all_users_with_their_roles(self):
        records = [_make_user_record("u1"), _make_user_record("u2")]
        ur1 = _make_user_role("u1", _FUNDER_ROLE, ur_id="ur-1")
        ur2 = _make_user_role("u2", _IMPLEMENTER_ROLE, institution_id="inst-a", ur_id="ur-2")
        svc, _ = await _make_service(records=records, user_roles=[ur1, ur2])

        result = await svc.list_managed_users(_make_user_info())

        assert {u.user_id for u in result} == {"u1", "u2"}
        u1 = next(u for u in result if u.user_id == "u1")
        assert len(u1.roles) == 1
        assert u1.roles[0].role_name == "funder"

    async def test_returns_empty_roles_for_users_with_no_assignments(self):
        svc, _ = await _make_service(records=[_make_user_record("u1")])

        result = await svc.list_managed_users(_make_user_info())

        assert result[0].roles == []

    async def test_raises_not_provisioned_when_caller_has_no_record(self):
        svc, _ = await _make_service()
        with pytest.raises(UserNotProvisionedError):
            await svc.list_managed_users(_make_user_info())


class TestAssignRole:
    async def test_assigns_role_and_returns_view(self):
        svc, ur_repo = await _make_service(records=[_make_user_record()])
        request = AssignRoleRequest(role_id=_FUNDER_ROLE.id, institution_id=None)

        result = await svc.assign_role(_make_user_info(), "u2", request)

        assert result.role_name == "funder"
        stored = await ur_repo.list_for_user("u2")
        assert len(stored) == 1

    async def test_raises_unknown_role_for_invalid_role_id(self):
        svc, _ = await _make_service(records=[_make_user_record()])
        from app.users.errors import UnknownRoleError
        with pytest.raises(UnknownRoleError):
            await svc.assign_role(_make_user_info(), "u2", AssignRoleRequest(role_id="no-such-id", institution_id=None))


class TestRevokeRole:
    async def test_revokes_user_role_successfully(self):
        ur = _make_user_role("u2", _FUNDER_ROLE, ur_id="ur-99")
        svc, ur_repo = await _make_service(records=[_make_user_record()], user_roles=[ur])

        await svc.revoke_role(_make_user_info(), "u2", "ur-99")

        assert await ur_repo.list_for_user("u2") == []

    async def test_raises_not_found_for_unknown_user_role_id(self):
        svc, _ = await _make_service(records=[_make_user_record()])
        from app.users.errors import GrantNotFoundError
        with pytest.raises(GrantNotFoundError):
            await svc.revoke_role(_make_user_info(), "u2", "no-such-id")



class TestRegister:
    async def test_persists_the_organization_given_at_registration(self):
        svc, _ = await _make_service()

        await svc.register(_make_user_info(), RegisterRequest(organization="Acme Corp"))

        stored = await svc._repo.get_by_user_id("u1")  # pylint: disable=protected-access
        assert stored.organization == "Acme Corp"

    async def test_persists_the_name_given_at_registration(self):
        svc, _ = await _make_service()
        no_name_claim = UserInfo(
            user_id="u1", name=None, email="user@example.com", token="tok", sign_in_provider=SignInProvider.PASSWORD  # nosec B106
        )

        await svc.register(no_name_claim, RegisterRequest(name="Kunda Tembo"))

        stored = await svc._repo.get_by_user_id("u1")  # pylint: disable=protected-access
        assert stored.name == "Kunda Tembo"

    async def test_prefers_the_given_name_over_the_jwt_name_claim(self):
        svc, _ = await _make_service()

        await svc.register(_make_user_info(), RegisterRequest(name="Kunda Tembo"))

        stored = await svc._repo.get_by_user_id("u1")  # pylint: disable=protected-access
        assert stored.name == "Kunda Tembo"

    async def test_falls_back_to_the_jwt_name_claim_when_no_name_is_given(self):
        svc, _ = await _make_service()

        await svc.register(_make_user_info(), RegisterRequest())

        stored = await svc._repo.get_by_user_id("u1")  # pylint: disable=protected-access
        assert stored.name == "Test User"
