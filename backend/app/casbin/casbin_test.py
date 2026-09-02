"""Tests for the Casbin package: model, adapter, enforcer, and requires dependency."""
from typing import TypedDict

import casbin
import httpx
import pytest
from fastapi import FastAPI

from app.auth.firebase import SignInProvider, UserInfo
from app.casbin.adapter import RolesAdapter
from app.casbin.enforcer import clear_enforcer_cache, get_enforcer
from app.casbin.model import build_model
from app.casbin.requires import CasbinAPIRouter, make_requires
from app.roles.repository import MongoRoleRepository, MongoUserRoleRepository
from app.users.types import ALL_INSTITUTIONS, Action, Subject


class _PermissionDoc(TypedDict):
    subject: str
    action: str


class _RoleDoc(TypedDict):
    name: str
    label: str
    description: str
    permissions: list[_PermissionDoc]
    assignable: bool


def _make_permission(subject: str, action: str) -> _PermissionDoc:
    return {"subject": subject, "action": action}


def _make_role_doc(name: str, permissions: list[_PermissionDoc]) -> _RoleDoc:
    return {
        "name": name,
        "label": name.capitalize(),
        "description": "",
        "permissions": permissions,
        "assignable": True,
    }


async def _insert_role(db, name: str, permissions: list[_PermissionDoc]) -> str:
    result = await db["roles"].insert_one(_make_role_doc(name, permissions))
    return str(result.inserted_id)


async def _assign_role(db, user_id: str, role_id: str, institution_id: str | None = None) -> None:
    await db["user_roles"].insert_one({
        "user_id": user_id,
        "role_id": role_id,
        "institution_id": institution_id,
        "granted_by": None,
        "granted_at": None,
    })


async def _fresh_enforcer(db) -> casbin.AsyncEnforcer:
    adapter = RolesAdapter(MongoRoleRepository(db), MongoUserRoleRepository(db))
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


class TestRolesAdapter:
    async def test_deployment_scoped_permission_allows_any_institution(self, in_memory_analytics_database):
        # GIVEN a deployment-scoped dashboard:view permission
        db = in_memory_analytics_database
        role_id = await _insert_role(db, "funder", [_make_permission("dashboard", "view")])
        await _assign_role(db, "u1", role_id, institution_id=None)
        enforcer = await _fresh_enforcer(db)

        assert enforcer.enforce("u1", "inst-a", "dashboard:view")
        assert enforcer.enforce("u1", "inst-z", "dashboard:view")

    async def test_institution_scoped_permission_allows_only_that_institution(self, in_memory_analytics_database):
        # GIVEN an institution-scoped dashboard:view permission, assigned to inst-a
        db = in_memory_analytics_database
        role_id = await _insert_role(db, "implementer", [_make_permission("dashboard", "view")])
        await _assign_role(db, "u1", role_id, institution_id="inst-a")
        enforcer = await _fresh_enforcer(db)

        assert enforcer.enforce("u1", "inst-a", "dashboard:view")
        assert not enforcer.enforce("u1", "inst-b", "dashboard:view")

    async def test_denies_when_no_roles_assigned(self, in_memory_analytics_database):
        enforcer = await _fresh_enforcer(in_memory_analytics_database)
        assert not enforcer.enforce("u1", "inst-a", "dashboard:view")

    async def test_does_not_grant_undeclared_permission(self, in_memory_analytics_database):
        db = in_memory_analytics_database
        role_id = await _insert_role(db, "viewer", [_make_permission("dashboard", "view")])
        await _assign_role(db, "u1", role_id)
        enforcer = await _fresh_enforcer(db)

        assert not enforcer.enforce("u1", ALL_INSTITUTIONS, "dashboard:manage")

    async def test_multiple_users_scoped_independently(self, in_memory_analytics_database):
        db = in_memory_analytics_database
        deploy_role = await _insert_role(db, "funder", [_make_permission("dashboard", "view")])
        inst_role = await _insert_role(db, "implementer", [_make_permission("dashboard", "view")])
        await _assign_role(db, "u1", deploy_role, institution_id=None)
        await _assign_role(db, "u2", inst_role, institution_id="inst-a")
        enforcer = await _fresh_enforcer(db)

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
        db = in_memory_analytics_database
        adapter = RolesAdapter(MongoRoleRepository(db), MongoUserRoleRepository(db))

        first = await get_enforcer(adapter)
        second = await get_enforcer(adapter)

        assert first is second

    async def test_clear_cache_forces_reinitialization(self, in_memory_analytics_database):
        db = in_memory_analytics_database
        adapter = RolesAdapter(MongoRoleRepository(db), MongoUserRoleRepository(db))
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
        def fake_user_info():
            return UserInfo(
                user_id=user_id,
                email="test@example.com",
                name="Test",
                token="tok",  # nosec B106
                sign_in_provider=SignInProvider.PASSWORD,
            )

        def get_role_repo():
            return MongoRoleRepository(db)

        def get_user_role_repo():
            return MongoUserRoleRepository(db)

        requires = make_requires(fake_user_info, get_role_repo, get_user_role_repo)
        app = FastAPI()
        router = CasbinAPIRouter(requires_factory=requires)

        @router.get("/protected")
        @requires(Subject.DASHBOARD, Action.VIEW)
        async def protected():
            return {"ok": True}

        @router.get("/scoped")
        @requires(Subject.DASHBOARD, Action.VIEW, resolves_scope=True)
        async def scoped():
            return {"ok": True}

        app.include_router(router)
        return app

    async def test_allows_deployment_scoped_role_for_any_institution(self, in_memory_analytics_database):
        db = in_memory_analytics_database
        role_id = await _insert_role(db, "funder", [_make_permission("dashboard", "view")])
        await _assign_role(db, "u1", role_id)

        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self._build_app(db, "u1")), base_url="http://test"
        ) as client:
            response = await client.get("/protected?institution_id=inst-a")

        assert response.status_code == 200

    async def test_allows_institution_scoped_role_for_own_institution(self, in_memory_analytics_database):
        db = in_memory_analytics_database
        role_id = await _insert_role(db, "implementer", [_make_permission("dashboard", "view")])
        await _assign_role(db, "u1", role_id, institution_id="inst-a")

        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self._build_app(db, "u1")), base_url="http://test"
        ) as client:
            response = await client.get("/protected?institution_id=inst-a")

        assert response.status_code == 200

    async def test_allows_scope_resolving_route_for_institution_scoped_caller(self, in_memory_analytics_database):
        db = in_memory_analytics_database
        role_id = await _insert_role(db, "implementer", [_make_permission("dashboard", "view")])
        await _assign_role(db, "u1", role_id, institution_id="inst-a")

        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self._build_app(db, "u1")), base_url="http://test"
        ) as client:
            response = await client.get("/scoped")

        assert response.status_code == 200

    async def test_denies_unscoped_route_for_institution_scoped_caller(self, in_memory_analytics_database):
        db = in_memory_analytics_database
        role_id = await _insert_role(db, "implementer", [_make_permission("dashboard", "view")])
        await _assign_role(db, "u1", role_id, institution_id="inst-a")

        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self._build_app(db, "u1")), base_url="http://test"
        ) as client:
            response = await client.get("/protected")

        assert response.status_code == 403

    async def test_denies_scope_resolving_route_for_caller_with_no_roles(self, in_memory_analytics_database):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self._build_app(in_memory_analytics_database, "nobody")),
            base_url="http://test",
        ) as client:
            response = await client.get("/scoped")

        assert response.status_code == 403

    async def test_allows_scope_resolving_route_for_deployment_wide_caller(self, in_memory_analytics_database):
        db = in_memory_analytics_database
        role_id = await _insert_role(db, "funder", [_make_permission("dashboard", "view")])
        await _assign_role(db, "u1", role_id)

        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self._build_app(db, "u1")), base_url="http://test"
        ) as client:
            response = await client.get("/scoped")

        assert response.status_code == 200

    async def test_denies_institution_scoped_caller_for_foreign_institution(self, in_memory_analytics_database):
        db = in_memory_analytics_database
        role_id = await _insert_role(db, "implementer", [_make_permission("dashboard", "view")])
        await _assign_role(db, "u1", role_id, institution_id="inst-a")

        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self._build_app(db, "u1")), base_url="http://test"
        ) as client:
            response = await client.get("/protected?institution_id=inst-b")

        assert response.status_code == 403

    async def test_denies_user_with_no_roles(self, in_memory_analytics_database):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self._build_app(in_memory_analytics_database, "u1")),
            base_url="http://test",
        ) as client:
            response = await client.get("/protected?institution_id=inst-a")

        assert response.status_code == 403

    async def test_denies_user_with_wrong_permission(self, in_memory_analytics_database):
        db = in_memory_analytics_database
        role_id = await _insert_role(db, "viewer", [_make_permission("institutions", "view")])
        await _assign_role(db, "u1", role_id)

        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self._build_app(db, "u1")), base_url="http://test"
        ) as client:
            response = await client.get("/protected?institution_id=inst-a")

        assert response.status_code == 403

    async def test_allows_deployment_wide_caller_without_institution_param(self, in_memory_analytics_database):
        db = in_memory_analytics_database
        role_id = await _insert_role(db, "funder", [_make_permission("dashboard", "view")])
        await _assign_role(db, "u1", role_id)

        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self._build_app(db, "u1")), base_url="http://test"
        ) as client:
            response = await client.get("/protected")

        assert response.status_code == 200

    async def test_denies_institution_scoped_caller_without_institution_param(self, in_memory_analytics_database):
        db = in_memory_analytics_database
        role_id = await _insert_role(db, "implementer", [_make_permission("dashboard", "view")])
        await _assign_role(db, "u1", role_id, institution_id="inst-a")

        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self._build_app(db, "u1")), base_url="http://test"
        ) as client:
            response = await client.get("/protected")

        assert response.status_code == 403
