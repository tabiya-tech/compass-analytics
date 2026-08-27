"""
Integration tests for the users routes.

Uses httpx.AsyncClient with ASGI transport against the in-memory Mongo fixture.
Auth runs in local mode so any HS256-signed JWT is accepted without Firebase
signature verification.

The Casbin enforcer singleton is cleared before each test class so that policy
changes made during seeding are reflected.
"""
import httpx
import jwt as pyjwt
import pytest
from fastapi import FastAPI

from app.app_config import ApplicationConfig, clear_application_config, set_application_config
from app.auth.api_key import ExternalService
from app.auth.firebase import Authentication
from app.casbin.adapter import GrantsAdapter
from app.casbin.enforcer import clear_enforcer_cache, get_enforcer
from app.grants.repository import MongoGrantRepository
from app.users.dependencies import get_grant_repository, get_user_service
from app.users.repository import USERS_COLLECTION, MongoUserRepository
from app.users.routes import add_users_routes
from app.users.service import UserService
from app.users.types import ALL_INSTITUTIONS, Action, Subject
from app.version.types import VersionInfo

_TEST_SECRET = "test-secret-key-long-enough-for-hs256"  # nosec B105


def _make_token(user_id: str = "u1", email: str = "user@example.com") -> str:
    return pyjwt.encode(
        {"sub": user_id, "email": email, "name": "Test User", "firebase": {"sign_in_provider": "password"}},
        key=_TEST_SECRET,
        algorithm="HS256",
    )


def _auth(user_id: str = "u1") -> dict:
    return {"Authorization": f"Bearer {_make_token(user_id=user_id)}"}


async def _seed_user(db, user_id: str = "u1", **overrides) -> None:
    doc = {"user_id": user_id, "email": f"{user_id}@example.com", "name": "Test User"}
    doc.update(overrides)
    await db[USERS_COLLECTION].insert_one(doc)


async def _seed_grant(db, user_id: str, subject: Subject, action: Action, institution_id: str) -> str:
    grant_repo = MongoGrantRepository(db)
    enforcer = await get_enforcer(GrantsAdapter(grant_repo))
    perm = f"{subject.value}:{action.value}"
    await enforcer.add_policy(user_id, institution_id, perm)
    record = await grant_repo.get_by_tuple(user_id, subject, action, institution_id)
    return record.grant_id


_DEPLOYMENT_MODULES = ["build-your-profile", "job-readiness"]


@pytest.fixture()
async def client(monkeypatch, in_memory_analytics_database):
    monkeypatch.setenv("TARGET_ENVIRONMENT_TYPE", "local")
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
        active_modules=_DEPLOYMENT_MODULES,
    ))

    app = FastAPI()
    auth = Authentication()
    add_users_routes(app, auth)

    grant_repo = MongoGrantRepository(in_memory_analytics_database)
    enforcer = await get_enforcer(GrantsAdapter(grant_repo))
    service = UserService(
        repository=MongoUserRepository(in_memory_analytics_database),
        grant_repository=grant_repo,
        enforcer=enforcer,
    )
    app.dependency_overrides[get_user_service] = lambda: service
    app.dependency_overrides[get_grant_repository] = lambda: grant_repo

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        c.db = in_memory_analytics_database
        yield c

    clear_enforcer_cache()
    clear_application_config()


class TestGetMe:
    async def test_returns_401_without_auth(self, client):
        assert (await client.get("/api/me")).status_code == 401

    async def test_returns_404_when_not_provisioned(self, client):
        assert (await client.get("/api/me", headers=_auth())).status_code == 404

    async def test_returns_profile_with_permissions_and_scope(self, client):
        # GIVEN a provisioned user with a wildcard dashboard grant
        await _seed_user(client.db, "u1")
        await _seed_grant(client.db, "u1", Subject.DASHBOARD, Action.VIEW, ALL_INSTITUTIONS)
        await _seed_grant(client.db, "u1", Subject.ACCOUNT, Action.VIEW, ALL_INSTITUTIONS)

        body = (await client.get("/api/me", headers=_auth())).json()

        assert body["user_id"] == "u1"
        assert "dashboard:view" in body["permissions"]
        assert "account:view" in body["permissions"]
        assert body["scope"]["type"] == "all"
        # active_modules comes from deployment config, not the user document
        assert body["active_modules"] == _DEPLOYMENT_MODULES

    async def test_prefers_jwt_identity_over_stored_copy(self, client):
        await _seed_user(client.db, "u1", email="stale@example.com", name="Stale")

        body = (await client.get("/api/me", headers=_auth())).json()

        assert body["email"] == "user@example.com"
        assert body["name"] == "Test User"

    async def test_returns_institutions_scope_for_scoped_user(self, client):
        await _seed_user(client.db, "u1")
        await _seed_grant(client.db, "u1", Subject.DASHBOARD, Action.VIEW, "inst-a")

        body = (await client.get("/api/me", headers=_auth())).json()

        assert body["scope"]["type"] == "institutions"
        assert body["scope"]["institution_ids"] == ["inst-a"]


class TestListUsers:
    async def test_returns_401_without_auth(self, client):
        assert (await client.get("/api/users?institution_id=inst-a")).status_code == 401

    async def test_returns_403_without_access_management_grant(self, client):
        await _seed_user(client.db, "u1")
        await _seed_grant(client.db, "u1", Subject.DASHBOARD, Action.VIEW, ALL_INSTITUTIONS)

        assert (await client.get("/api/users?institution_id=inst-a", headers=_auth())).status_code == 403

    async def test_returns_403_without_institution_id_when_user_has_no_wildcard_grant(self, client):
        # institution_id defaults to ALL_INSTITUTIONS; a user without a wildcard grant is denied
        await _seed_user(client.db, "u1")
        await _seed_grant(client.db, "u1", Subject.ACCESS_MANAGEMENT, Action.MANAGE, "inst-a")

        assert (await client.get("/api/users", headers=_auth())).status_code == 403

    async def test_returns_users_with_grants_for_authorized_caller(self, client):
        await _seed_user(client.db, "u1")
        await _seed_user(client.db, "u2")
        await _seed_grant(client.db, "u1", Subject.ACCESS_MANAGEMENT, Action.MANAGE, ALL_INSTITUTIONS)

        body = (await client.get("/api/users?institution_id=inst-a", headers=_auth())).json()

        assert isinstance(body, list)
        user_ids = {u["user_id"] for u in body}
        assert "u1" in user_ids
        assert "u2" in user_ids


class TestCreateGrant:
    async def test_returns_401_without_auth(self, client):
        assert (await client.post(
            "/api/users/u2/grants?institution_id=inst-a",
            json={"subject": "dashboard", "action": "view", "institution_id": "inst-a"},
        )).status_code == 401

    async def test_returns_403_without_access_management_grant(self, client):
        await _seed_user(client.db, "u1")
        await _seed_grant(client.db, "u1", Subject.DASHBOARD, Action.VIEW, ALL_INSTITUTIONS)

        assert (await client.post(
            "/api/users/u2/grants?institution_id=inst-a",
            json={"subject": "dashboard", "action": "view", "institution_id": "inst-a"},
            headers=_auth(),
        )).status_code == 403

    async def test_creates_grant_and_returns_201(self, client):
        await _seed_user(client.db, "u1")
        await _seed_user(client.db, "u2")
        await _seed_grant(client.db, "u1", Subject.ACCESS_MANAGEMENT, Action.MANAGE, ALL_INSTITUTIONS)

        response = await client.post(
            "/api/users/u2/grants?institution_id=inst-a",
            json={"subject": "dashboard", "action": "view", "institution_id": "inst-a"},
            headers=_auth(),
        )

        assert response.status_code == 201
        body = response.json()
        assert body["subject"] == "dashboard"
        assert body["action"] == "view"
        assert body["institution_id"] == "inst-a"
        assert "grant_id" in body


class TestAssignRole:
    async def test_returns_403_without_access_management_grant(self, client):
        await _seed_user(client.db, "u1")

        assert (await client.post(
            "/api/users/u2/roles?institution_id=inst-a",
            json={"role": "implementer", "institution_id": "inst-a"},
            headers=_auth(),
        )).status_code == 403

    async def test_expands_role_and_returns_grants(self, client):
        await _seed_user(client.db, "u1")
        await _seed_user(client.db, "u2")
        await _seed_grant(client.db, "u1", Subject.ACCESS_MANAGEMENT, Action.MANAGE, ALL_INSTITUTIONS)

        response = await client.post(
            "/api/users/u2/roles?institution_id=inst-a",
            json={"role": "implementer", "institution_id": "inst-a"},
            headers=_auth(),
        )

        assert response.status_code == 201
        body = response.json()
        assert isinstance(body, list)
        assert len(body) > 0
        assert all(g["institution_id"] == "inst-a" for g in body)

    async def test_returns_422_for_unknown_role(self, client):
        await _seed_user(client.db, "u1")
        await _seed_grant(client.db, "u1", Subject.ACCESS_MANAGEMENT, Action.MANAGE, ALL_INSTITUTIONS)

        response = await client.post(
            "/api/users/u2/roles?institution_id=inst-a",
            json={"role": "superadmin", "institution_id": "inst-a"},
            headers=_auth(),
        )

        assert response.status_code == 422


class TestRevokeGrant:
    async def test_returns_403_without_access_management_grant(self, client):
        await _seed_user(client.db, "u1")

        assert (await client.delete(
            "/api/users/u2/grants/g1?institution_id=inst-a", headers=_auth()
        )).status_code == 403

    async def test_deletes_grant_and_returns_204(self, client):
        await _seed_user(client.db, "u1")
        await _seed_user(client.db, "u2")
        await _seed_grant(client.db, "u1", Subject.ACCESS_MANAGEMENT, Action.MANAGE, ALL_INSTITUTIONS)
        grant_id = await _seed_grant(client.db, "u2", Subject.DASHBOARD, Action.VIEW, "inst-a")

        response = await client.delete(
            f"/api/users/u2/grants/{grant_id}?institution_id=inst-a", headers=_auth()
        )

        assert response.status_code == 204

    async def test_returns_404_for_nonexistent_grant(self, client):
        await _seed_user(client.db, "u1")
        await _seed_grant(client.db, "u1", Subject.ACCESS_MANAGEMENT, Action.MANAGE, ALL_INSTITUTIONS)

        response = await client.delete(
            "/api/users/u2/grants/no-such-grant?institution_id=inst-a", headers=_auth()
        )

        assert response.status_code == 404
