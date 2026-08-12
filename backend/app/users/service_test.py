"""
Unit tests for UserService.

Fake repositories stand in for MongoDB. DB round-trips are covered by the
route integration tests in routes_test.py.
"""
import pytest

from app.auth.firebase import SignInProvider, UserInfo
from app.grants.repository import IGrantRepository
from app.grants.types import GrantRecord, GrantRequest, RoleRequest
from app.users.repository import IUserRepository
from app.users.service import (
    ForbiddenInstitutionError,
    UnknownRoleError,
    UserNotProvisionedError,
    UserService,
)
from app.users.types import ALL_INSTITUTIONS, Action, ScopeType, Subject, UserRecord


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


class _FakeGrantRepository(IGrantRepository):
    def __init__(self, grants: list[GrantRecord] | None = None):
        self._grants: list[GrantRecord] = grants or []
        self._next_id = 0

    def _new_id(self) -> str:
        self._next_id += 1
        return f"grant-{self._next_id}"

    async def list_all(self) -> list[GrantRecord]:
        return list(self._grants)

    async def list_for_user(self, user_id: str) -> list[GrantRecord]:
        return [g for g in self._grants if g.user_id == user_id]

    async def list_for_users(self, user_ids: list[str]) -> list[GrantRecord]:
        return [g for g in self._grants if g.user_id in user_ids]

    async def create(self, user_id, subject, action, institution_id, granted_by) -> GrantRecord:
        existing = next(
            (g for g in self._grants if g.user_id == user_id and g.subject == subject
             and g.action == action and g.institution_id == institution_id),
            None,
        )
        if existing:
            return existing
        record = GrantRecord(
            grant_id=self._new_id(),
            user_id=user_id,
            subject=subject,
            action=action,
            institution_id=institution_id,
            granted_by=granted_by,
        )
        self._grants.append(record)
        return record

    async def delete(self, user_id: str, grant_id: str) -> bool:
        before = len(self._grants)
        self._grants = [g for g in self._grants if not (g.user_id == user_id and g.grant_id == grant_id)]
        return len(self._grants) < before


def _user_info(user_id: str = "u1") -> UserInfo:
    return UserInfo(
        user_id=user_id,
        name="Test User",
        email="user@example.com",
        token="tok",  # nosec B106
        sign_in_provider=SignInProvider.PASSWORD,
    )


def _record(user_id: str = "u1") -> UserRecord:
    return UserRecord(user_id=user_id, email=f"{user_id}@example.com", name="Test User")


def _grant(user_id: str, subject: Subject, action: Action, institution_id: str, grant_id: str = "g1") -> GrantRecord:
    return GrantRecord(grant_id=grant_id, user_id=user_id, subject=subject, action=action, institution_id=institution_id)


def _service(
    records: list[UserRecord] | None = None,
    grants: list[GrantRecord] | None = None,
) -> UserService:
    return UserService(
        repository=_FakeUserRepository(records or []),
        grant_repository=_FakeGrantRepository(grants or []),
    )


class TestGetMe:
    async def test_returns_permissions_derived_from_grants(self):
        # GIVEN a user with two grants
        grants = [
            _grant("u1", Subject.DASHBOARD, Action.VIEW, ALL_INSTITUTIONS, "g1"),
            _grant("u1", Subject.ACCOUNT, Action.VIEW, ALL_INSTITUTIONS, "g2"),
        ]
        service = _service(records=[_record()], grants=grants)

        result = await service.get_me(_user_info())

        assert "dashboard:view" in result.permissions
        assert "account:view" in result.permissions

    async def test_returns_all_scope_when_dashboard_grant_is_wildcard(self):
        # GIVEN a wildcard dashboard:view grant
        grants = [_grant("u1", Subject.DASHBOARD, Action.VIEW, ALL_INSTITUTIONS)]
        service = _service(records=[_record()], grants=grants)

        result = await service.get_me(_user_info())

        assert result.scope.type == ScopeType.ALL

    async def test_returns_institutions_scope_when_dashboard_grant_is_scoped(self):
        # GIVEN a dashboard:view grant scoped to inst-a
        grants = [_grant("u1", Subject.DASHBOARD, Action.VIEW, "inst-a")]
        service = _service(records=[_record()], grants=grants)

        result = await service.get_me(_user_info())

        assert result.scope.type == ScopeType.INSTITUTIONS
        assert result.scope.institution_ids == ["inst-a"]

    async def test_prefers_jwt_identity_over_stored_copy(self):
        # GIVEN a record with stale identity
        record = UserRecord(user_id="u1", email="stale@example.com", name="Stale")
        service = _service(records=[record])

        result = await service.get_me(_user_info())

        assert result.email == "user@example.com"
        assert result.name == "Test User"

    async def test_raises_not_provisioned_when_no_record(self):
        service = _service()
        with pytest.raises(UserNotProvisionedError):
            await service.get_me(_user_info())


class TestResolveScope:
    async def test_all_scope_with_no_drilldown_returns_none_filter(self):
        # GIVEN deployment-wide dashboard access
        grants = [_grant("u1", Subject.DASHBOARD, Action.VIEW, ALL_INSTITUTIONS)]
        service = _service(records=[_record()], grants=grants)

        result = await service.resolve_scope(_user_info(), None)

        assert result.institution_ids is None

    async def test_all_scope_drilldown_passes_through_institution(self):
        grants = [_grant("u1", Subject.DASHBOARD, Action.VIEW, ALL_INSTITUTIONS)]
        service = _service(records=[_record()], grants=grants)

        result = await service.resolve_scope(_user_info(), "inst-a")

        assert result.institution_ids == ["inst-a"]

    async def test_institutions_scope_with_no_drilldown_returns_all_granted(self):
        # GIVEN grants for two institutions
        grants = [
            _grant("u1", Subject.DASHBOARD, Action.VIEW, "inst-a", "g1"),
            _grant("u1", Subject.DASHBOARD, Action.VIEW, "inst-b", "g2"),
        ]
        service = _service(records=[_record()], grants=grants)

        result = await service.resolve_scope(_user_info(), None)

        assert sorted(result.institution_ids) == ["inst-a", "inst-b"]

    async def test_institutions_scope_drilldown_into_own_institution(self):
        grants = [_grant("u1", Subject.DASHBOARD, Action.VIEW, "inst-a")]
        service = _service(records=[_record()], grants=grants)

        result = await service.resolve_scope(_user_info(), "inst-a")

        assert result.institution_ids == ["inst-a"]

    async def test_institutions_scope_drilldown_into_foreign_institution_raises(self):
        grants = [_grant("u1", Subject.DASHBOARD, Action.VIEW, "inst-a")]
        service = _service(records=[_record()], grants=grants)

        with pytest.raises(ForbiddenInstitutionError):
            await service.resolve_scope(_user_info(), "inst-x")

    async def test_raises_not_provisioned_when_no_record(self):
        service = _service()
        with pytest.raises(UserNotProvisionedError):
            await service.resolve_scope(_user_info(), None)


class TestListManagedUsers:
    async def test_returns_all_users_with_their_grants(self):
        records = [_record("u1"), _record("u2")]
        grants = [
            _grant("u1", Subject.DASHBOARD, Action.VIEW, ALL_INSTITUTIONS, "g1"),
            _grant("u2", Subject.INSTITUTIONS, Action.VIEW, "inst-a", "g2"),
        ]
        service = _service(records=records, grants=grants)

        result = await service.list_managed_users(_user_info())

        assert {u.user_id for u in result} == {"u1", "u2"}
        u1 = next(u for u in result if u.user_id == "u1")
        assert len(u1.grants) == 1
        assert u1.grants[0].grant_id == "g1"

    async def test_returns_empty_grants_for_users_with_no_grants(self):
        service = _service(records=[_record("u1")])

        result = await service.list_managed_users(_user_info())

        assert result[0].grants == []

    async def test_raises_not_provisioned_when_caller_has_no_record(self):
        service = _service()
        with pytest.raises(UserNotProvisionedError):
            await service.list_managed_users(_user_info())


class TestGrant:
    async def test_creates_and_returns_grant_view(self):
        service = _service(records=[_record()])
        request = GrantRequest(subject=Subject.DASHBOARD, action=Action.VIEW, institution_id="inst-a")

        result = await service.grant(_user_info(), "u2", request)

        assert result.subject == Subject.DASHBOARD
        assert result.action == Action.VIEW
        assert result.institution_id == "inst-a"

    async def test_raises_not_provisioned_when_caller_has_no_record(self):
        service = _service()
        with pytest.raises(UserNotProvisionedError):
            await service.grant(_user_info(), "u2", GrantRequest(
                subject=Subject.DASHBOARD, action=Action.VIEW, institution_id="inst-a"
            ))


class TestAssignRole:
    async def test_expands_implementer_role_to_grants(self):
        service = _service(records=[_record()])
        request = RoleRequest(role="implementer", institution_id="inst-a")

        result = await service.assign_role(_user_info(), "u2", request)

        subjects = {g.subject for g in result}
        assert Subject.DASHBOARD in subjects
        assert Subject.JOBSEEKERS in subjects
        assert Subject.ACCOUNT in subjects
        assert all(g.institution_id == "inst-a" for g in result)

    async def test_expands_funder_role_to_grants(self):
        service = _service(records=[_record()])
        request = RoleRequest(role="funder", institution_id=ALL_INSTITUTIONS)

        result = await service.assign_role(_user_info(), "u2", request)

        subjects = {g.subject for g in result}
        assert Subject.INSTITUTIONS in subjects
        assert Subject.ACCESS_MANAGEMENT in subjects

    async def test_raises_unknown_role_for_invalid_role_name(self):
        service = _service(records=[_record()])
        with pytest.raises(UnknownRoleError):
            await service.assign_role(_user_info(), "u2", RoleRequest(role="superadmin", institution_id="inst-a"))

    async def test_raises_not_provisioned_when_caller_has_no_record(self):
        service = _service()
        with pytest.raises(UserNotProvisionedError):
            await service.assign_role(_user_info(), "u2", RoleRequest(role="implementer", institution_id="inst-a"))


class TestRevoke:
    async def test_deletes_grant_successfully(self):
        grants = [_grant("u2", Subject.DASHBOARD, Action.VIEW, "inst-a", "g1")]
        service = _service(records=[_record()], grants=grants)

        await service.revoke(_user_info(), "u2", "g1")

    async def test_raises_key_error_when_grant_not_found(self):
        service = _service(records=[_record()])
        with pytest.raises(KeyError):
            await service.revoke(_user_info(), "u2", "no-such-grant")

    async def test_raises_not_provisioned_when_caller_has_no_record(self):
        service = _service()
        with pytest.raises(UserNotProvisionedError):
            await service.revoke(_user_info(), "u2", "g1")
