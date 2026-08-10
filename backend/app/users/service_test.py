"""
Unit tests for UserService — role/scope resolution is the security-critical
core of the analytics API, so every branch of the access matrix is covered.

A fake in-memory repository stands in for MongoDB; the DB round-trip itself is
covered by the /api/me route tests against the in-memory Mongo fixture.
"""
import pytest

from app.auth.firebase import SignInProvider, UserInfo
from app.users.repository import IUserRepository
from app.users.service import (
    ForbiddenInstitutionError,
    UserNotProvisionedError,
    UserService,
)
from app.users.types import ScopeType, UserRecord, UserRole


class _FakeUserRepository(IUserRepository):
    def __init__(self, record: UserRecord | None):
        self._record = record

    async def get_by_user_id(self, user_id: str) -> UserRecord | None:
        if self._record is not None and self._record.user_id == user_id:
            return self._record
        return None


def _user_info(user_id: str = "u1") -> UserInfo:
    return UserInfo(
        user_id=user_id,
        name="Test User",
        email="user@example.com",
        token="tok",  # nosec B106 — dummy JWT string for a UserInfo fixture, not a credential
        sign_in_provider=SignInProvider.PASSWORD,
    )


def _service(record: UserRecord | None) -> UserService:
    return UserService(repository=_FakeUserRepository(record))


def _implementer(institution_ids: list[str]) -> UserRecord:
    return UserRecord(
        user_id="u1",
        role=UserRole.IMPLEMENTER,
        scope_type=ScopeType.INSTITUTIONS,
        institution_ids=institution_ids,
    )


def _funder(scope_type: ScopeType, institution_ids: list[str]) -> UserRecord:
    return UserRecord(
        user_id="u1",
        role=UserRole.FUNDER,
        scope_type=scope_type,
        institution_ids=institution_ids,
    )


class TestGetMe:
    async def test_should_return_profile_for_a_provisioned_user(self):
        # GIVEN a provisioned implementer
        service = _service(_implementer(["inst-a"]))

        # WHEN get_me is called
        actual = await service.get_me(_user_info())

        # THEN the profile reflects the record's role and scope
        assert actual.user_id == "u1"
        assert actual.role == UserRole.IMPLEMENTER
        assert actual.scope.type == ScopeType.INSTITUTIONS
        assert actual.scope.institution_ids == ["inst-a"]

    async def test_should_prefer_jwt_identity_over_stored_copy(self):
        # GIVEN a record with stale identity fields
        record = _implementer(["inst-a"])
        record.email = "stale@example.com"
        record.name = "Stale Name"
        service = _service(record)

        # WHEN get_me is called with a fresh JWT
        actual = await service.get_me(_user_info())

        # THEN the JWT identity wins
        assert actual.email == "user@example.com"
        assert actual.name == "Test User"

    async def test_should_raise_not_provisioned_when_no_record_exists(self):
        # GIVEN no record for the caller
        service = _service(None)

        # WHEN / THEN get_me raises UserNotProvisionedError
        with pytest.raises(UserNotProvisionedError):
            await service.get_me(_user_info())


class TestResolveScopeImplementer:
    async def test_should_scope_to_own_institutions_when_no_drilldown(self):
        # GIVEN an implementer with two institutions
        service = _service(_implementer(["inst-a", "inst-b"]))

        # WHEN scope is resolved with no drill-down
        actual = await service.resolve_scope(_user_info(), None)

        # THEN it forwards their own institutions
        assert actual.institution_ids == ["inst-a", "inst-b"]

    async def test_should_allow_drilldown_into_own_institution(self):
        # GIVEN an implementer with two institutions
        service = _service(_implementer(["inst-a", "inst-b"]))

        # WHEN they drill into one of their own
        actual = await service.resolve_scope(_user_info(), "inst-b")

        # THEN only that institution is forwarded
        assert actual.institution_ids == ["inst-b"]

    async def test_should_reject_drilldown_into_a_foreign_institution(self):
        # GIVEN an implementer scoped to inst-a
        service = _service(_implementer(["inst-a"]))

        # WHEN they request a foreign institution
        # THEN it is forbidden
        with pytest.raises(ForbiddenInstitutionError):
            await service.resolve_scope(_user_info(), "inst-x")


class TestResolveScopeFunder:
    async def test_should_return_none_filter_for_all_scope_aggregate(self):
        # GIVEN a funder overseeing the whole deployment
        service = _service(_funder(ScopeType.ALL, []))

        # WHEN scope is resolved with no drill-down
        actual = await service.resolve_scope(_user_info(), None)

        # THEN no institution filter is applied (whole deployment)
        assert actual.institution_ids is None

    async def test_should_forward_portfolio_for_institutions_scope_aggregate(self):
        # GIVEN a funder scoped to an explicit portfolio
        service = _service(_funder(ScopeType.INSTITUTIONS, ["inst-a", "inst-b"]))

        # WHEN scope is resolved with no drill-down
        actual = await service.resolve_scope(_user_info(), None)

        # THEN the full portfolio is forwarded
        assert actual.institution_ids == ["inst-a", "inst-b"]

    async def test_should_allow_drilldown_within_portfolio(self):
        # GIVEN a funder with a two-institution portfolio
        service = _service(_funder(ScopeType.INSTITUTIONS, ["inst-a", "inst-b"]))

        # WHEN they drill into one
        actual = await service.resolve_scope(_user_info(), "inst-a")

        # THEN only that institution is forwarded
        assert actual.institution_ids == ["inst-a"]

    async def test_should_allow_drilldown_into_any_institution_when_scope_is_all(self):
        # GIVEN a funder with ALL scope
        service = _service(_funder(ScopeType.ALL, []))

        # WHEN they drill into an arbitrary institution
        actual = await service.resolve_scope(_user_info(), "inst-anything")

        # THEN it is allowed (the whole deployment is in-portfolio)
        assert actual.institution_ids == ["inst-anything"]

    async def test_should_reject_drilldown_outside_portfolio(self):
        # GIVEN a funder scoped to a specific portfolio
        service = _service(_funder(ScopeType.INSTITUTIONS, ["inst-a"]))

        # WHEN they drill into an institution outside it
        # THEN it is forbidden
        with pytest.raises(ForbiddenInstitutionError):
            await service.resolve_scope(_user_info(), "inst-z")

    async def test_should_raise_not_provisioned_when_no_record_exists(self):
        # GIVEN no record for the caller
        service = _service(None)

        # WHEN / THEN resolving scope raises UserNotProvisionedError
        with pytest.raises(UserNotProvisionedError):
            await service.resolve_scope(_user_info(), None)
