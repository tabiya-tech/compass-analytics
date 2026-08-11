"""
Tests for the Casbin package: model, adapter, enforcer, and requires dependency.

The in_memory_analytics_database fixture provides a real (ephemeral) Mongo
instance so the adapter exercises a genuine Motor round-trip.
"""
import casbin
import httpx
import pytest
from fastapi import Depends, FastAPI

from app.auth.firebase import SignInProvider, UserInfo
from app.grants.repository import MongoGrantRepository
from app.users.casbin.adapter import GrantsAdapter
from app.users.casbin.enforcer import clear_enforcer_cache, get_enforcer
from app.users.casbin.model import build_model
from app.users.casbin.requires import make_requires
from app.users.types import ALL_INSTITUTIONS, Action, Subject


async def _fresh_enforcer(grant_repo: MongoGrantRepository) -> casbin.AsyncEnforcer:
    """Build a fresh enforcer bypassing the singleton — for isolated test assertions."""
    adapter = GrantsAdapter(grant_repo)
    enforcer = casbin.AsyncEnforcer(build_model(), adapter)
    await enforcer.load_policy()
    return enforcer


class TestModel:
    def test_build_model_returns_a_casbin_model(self):
        model = build_model()
        assert isinstance(model, casbin.Model)

    def test_model_has_required_sections(self):
        model = build_model()
        assert "r" in model.model
        assert "p" in model.model
        assert "e" in model.model
        assert "m" in model.model


class TestGrantsAdapter:
    async def test_wildcard_grant_allows_any_institution(self, in_memory_analytics_database):
        # GIVEN a wildcard grant
        repo = MongoGrantRepository(in_memory_analytics_database)
        await repo.create("u1", Subject.DASHBOARD, Action.VIEW, ALL_INSTITUTIONS, granted_by=None)
        enforcer = await _fresh_enforcer(repo)

        # THEN the user passes enforcement for any institution
        assert enforcer.enforce("u1", "inst-a", "dashboard:view")
        assert enforcer.enforce("u1", "inst-z", "dashboard:view")

    async def test_institution_scoped_grant_allows_only_that_institution(self, in_memory_analytics_database):
        # GIVEN a grant scoped to inst-a
        repo = MongoGrantRepository(in_memory_analytics_database)
        await repo.create("u1", Subject.DASHBOARD, Action.VIEW, "inst-a", granted_by=None)
        enforcer = await _fresh_enforcer(repo)

        # THEN inst-a is allowed, inst-b is not
        assert enforcer.enforce("u1", "inst-a", "dashboard:view")
        assert not enforcer.enforce("u1", "inst-b", "dashboard:view")

    async def test_denies_when_no_grants(self, in_memory_analytics_database):
        # GIVEN an empty grants collection
        repo = MongoGrantRepository(in_memory_analytics_database)
        enforcer = await _fresh_enforcer(repo)

        assert not enforcer.enforce("u1", "inst-a", "dashboard:view")

    async def test_does_not_grant_undeclared_permission(self, in_memory_analytics_database):
        # GIVEN only dashboard:view
        repo = MongoGrantRepository(in_memory_analytics_database)
        await repo.create("u1", Subject.DASHBOARD, Action.VIEW, ALL_INSTITUTIONS, granted_by=None)
        enforcer = await _fresh_enforcer(repo)

        assert not enforcer.enforce("u1", ALL_INSTITUTIONS, "dashboard:manage")

    async def test_multiple_users_scoped_independently(self, in_memory_analytics_database):
        # GIVEN u1 has a wildcard grant, u2 has an institution-scoped grant
        repo = MongoGrantRepository(in_memory_analytics_database)
        await repo.create("u1", Subject.DASHBOARD, Action.VIEW, ALL_INSTITUTIONS, granted_by=None)
        await repo.create("u2", Subject.DASHBOARD, Action.VIEW, "inst-a", granted_by=None)
        enforcer = await _fresh_enforcer(repo)

        assert enforcer.enforce("u1", "inst-b", "dashboard:view")
        assert enforcer.enforce("u2", "inst-a", "dashboard:view")
        assert not enforcer.enforce("u2", "inst-b", "dashboard:view")
        assert not enforcer.enforce("u1", "inst-a", "institutions:view")


class TestEnforcerSingleton:
    def setup_method(self):
        clear_enforcer_cache()

    def teardown_method(self):
        clear_enforcer_cache()

    async def test_returns_same_instance_on_repeated_calls(self, in_memory_analytics_database):
        repo = MongoGrantRepository(in_memory_analytics_database)
        adapter = GrantsAdapter(repo)

        first = await get_enforcer(adapter)
        second = await get_enforcer(adapter)

        assert first is second

    async def test_clear_cache_forces_reinitialization(self, in_memory_analytics_database):
        repo = MongoGrantRepository(in_memory_analytics_database)
        adapter = GrantsAdapter(repo)
        first = await get_enforcer(adapter)

        clear_enforcer_cache()
        second = await get_enforcer(adapter)

        assert first is not second


class TestRequiresDependency:
    def setup_method(self):
        clear_enforcer_cache()

    def teardown_method(self):
        clear_enforcer_cache()

    def _build_app(self, db, user_id: str) -> FastAPI:
        repo = MongoGrantRepository(db)

        def fake_user_info():
            return UserInfo(
                user_id=user_id,
                email="test@example.com",
                name="Test",
                token="tok",  # nosec B106
                sign_in_provider=SignInProvider.PASSWORD,
            )

        def get_repo():
            return repo

        requires = make_requires(fake_user_info, get_repo)
        app = FastAPI()

        @app.get("/protected", dependencies=[Depends(requires(Subject.DASHBOARD, Action.VIEW))])
        async def protected():
            return {"ok": True}

        return app

    async def test_allows_wildcard_grant_for_any_institution(self, in_memory_analytics_database):
        # GIVEN a wildcard grant
        repo = MongoGrantRepository(in_memory_analytics_database)
        await repo.create("u1", Subject.DASHBOARD, Action.VIEW, ALL_INSTITUTIONS, granted_by=None)

        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self._build_app(in_memory_analytics_database, "u1")),
            base_url="http://test",
        ) as client:
            # WHEN requesting with any institution_id
            response = await client.get("/protected?institution_id=inst-a")

        assert response.status_code == 200

    async def test_allows_institution_scoped_grant_for_own_institution(self, in_memory_analytics_database):
        # GIVEN a grant scoped to inst-a
        repo = MongoGrantRepository(in_memory_analytics_database)
        await repo.create("u1", Subject.DASHBOARD, Action.VIEW, "inst-a", granted_by=None)

        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self._build_app(in_memory_analytics_database, "u1")),
            base_url="http://test",
        ) as client:
            response = await client.get("/protected?institution_id=inst-a")

        assert response.status_code == 200

    async def test_denies_institution_scoped_grant_for_foreign_institution(self, in_memory_analytics_database):
        # GIVEN a grant scoped to inst-a only
        repo = MongoGrantRepository(in_memory_analytics_database)
        await repo.create("u1", Subject.DASHBOARD, Action.VIEW, "inst-a", granted_by=None)

        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self._build_app(in_memory_analytics_database, "u1")),
            base_url="http://test",
        ) as client:
            # WHEN requesting for inst-b
            response = await client.get("/protected?institution_id=inst-b")

        assert response.status_code == 403

    async def test_denies_user_with_no_grants(self, in_memory_analytics_database):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self._build_app(in_memory_analytics_database, "u1")),
            base_url="http://test",
        ) as client:
            response = await client.get("/protected?institution_id=inst-a")

        assert response.status_code == 403

    async def test_denies_user_with_wrong_permission(self, in_memory_analytics_database):
        # GIVEN institutions:view but not dashboard:view
        repo = MongoGrantRepository(in_memory_analytics_database)
        await repo.create("u1", Subject.INSTITUTIONS, Action.VIEW, ALL_INSTITUTIONS, granted_by=None)

        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self._build_app(in_memory_analytics_database, "u1")),
            base_url="http://test",
        ) as client:
            response = await client.get("/protected?institution_id=inst-a")

        assert response.status_code == 403

    async def test_returns_422_when_institution_id_is_missing(self, in_memory_analytics_database):
        # institution_id is required — omitting it is a bad request, not a 403
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self._build_app(in_memory_analytics_database, "u1")),
            base_url="http://test",
        ) as client:
            response = await client.get("/protected")

        assert response.status_code == 422
