"""
Integration tests for the roles routes.

Uses httpx.AsyncClient with ASGI transport against the in-memory Mongo fixture.
Auth runs in local mode so any HS256-signed JWT is accepted without Firebase
signature verification.
"""
import httpx
import jwt as pyjwt
import pytest
from fastapi import FastAPI

from app.app_config import ApplicationConfig, clear_application_config, set_application_config
from app.auth.api_key import ExternalService
from app.auth.firebase import Authentication
from app.casbin.enforcer import clear_enforcer_cache
from app.roles.repository import ROLES_COLLECTION, USER_ROLES_COLLECTION, MongoRoleRepository, MongoUserRoleRepository
from app.roles.routes import add_roles_routes
from app.users.dependencies import get_role_repository, get_user_role_repository
from app.users.repository import USERS_COLLECTION
from app.version.types import VersionInfo

_TEST_SECRET = "test-secret-key-long-enough-for-hs256"  # nosec B105


def _make_token(user_id: str = "u1") -> str:
    return pyjwt.encode({"sub": user_id, "email": f"{user_id}@example.com", "firebase": {"sign_in_provider": "password"}}, key=_TEST_SECRET, algorithm="HS256")


def _auth(user_id: str = "u1") -> dict:
    return {"Authorization": f"Bearer {_make_token(user_id=user_id)}"}


async def _seed_user(db, user_id: str = "u1") -> None:
    await db[USERS_COLLECTION].insert_one({"user_id": user_id, "email": f"{user_id}@example.com", "name": "Test User"})


async def _seed_role(db, name: str, permissions: list[dict]) -> str:
    result = await db[ROLES_COLLECTION].insert_one({
        "name": name, "label": name.capitalize(), "description": f"{name} role",
        "permissions": permissions, "assignable": True,
    })
    return str(result.inserted_id)


async def _seed_user_role(db, user_id: str, role_id: str) -> None:
    await db[USER_ROLES_COLLECTION].insert_one({
        "user_id": user_id, "role_id": role_id, "institution_id": None, "granted_by": None, "granted_at": None,
    })


def _make_app(db, monkeypatch) -> FastAPI:
    monkeypatch.setenv("TARGET_ENVIRONMENT_TYPE", "local")
    app = FastAPI()
    auth = Authentication()
    add_roles_routes(app, auth)
    role_repo = MongoRoleRepository(db)
    user_role_repo = MongoUserRoleRepository(db)
    app.dependency_overrides[get_role_repository] = lambda: role_repo
    app.dependency_overrides[get_user_role_repository] = lambda: user_role_repo
    return app


@pytest.fixture()
async def client(monkeypatch, in_memory_analytics_database):
    clear_enforcer_cache()
    set_application_config(ApplicationConfig(
        version_info=VersionInfo(),
        environment_type="local",
        environment_name="local",
        frontend_url="http://localhost:5173",
        backend_url="http://localhost:8080",
        enable_sentry=False,
        analytics_mongodb_uri="mongodb://localhost:27017",
        analytics_database_name="test",
        service_api_keys={ExternalService.COMPASS: "test-key"},
        compass_base_url="http://localhost:9999",
        active_modules=[],
    ))
    db = in_memory_analytics_database
    app = _make_app(db, monkeypatch)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        client.db = db
        yield client
    clear_enforcer_cache()
    clear_application_config()


class TestListRoles:
    async def test_returns_401_without_auth(self, client):
        assert (await client.get("/api/roles")).status_code == 401

    async def test_returns_403_without_access_management_permission(self, client):
        await _seed_user(client.db)
        role_id = await _seed_role(client.db, "viewer", [{"subject": "dashboard", "action": "view"}])
        await _seed_user_role(client.db, "u1", role_id)

        assert (await client.get("/api/roles", headers=_auth())).status_code == 403

    async def test_returns_all_roles_for_authorized_caller(self, client):
        await _seed_user(client.db)
        role_id = await _seed_role(client.db, "admin", [{"subject": "access-management", "action": "manage"}])
        await _seed_user_role(client.db, "u1", role_id)
        await _seed_role(client.db, "viewer", [{"subject": "dashboard", "action": "view"}])

        body = (await client.get("/api/roles", headers=_auth())).json()

        assert isinstance(body, list)
        names = {role["name"] for role in body}
        assert "admin" in names
        assert "viewer" in names
