"""
Integration tests for the users routes.

Uses httpx.AsyncClient with ASGI transport against the in-memory Mongo fixture.
Auth runs in local mode so any HS256-signed JWT is accepted without Firebase
signature verification.

The Casbin enforcer singleton is cleared before and after each test so policy
changes made during seeding are always reflected.
"""
import httpx
import jwt as pyjwt
import pytest
from bson import ObjectId
from fastapi import FastAPI

from app.app_config import ApplicationConfig, clear_application_config, set_application_config
from app.auth.api_key import ExternalService
from app.auth.firebase import Authentication
from app.casbin.enforcer import clear_enforcer_cache
from app.roles.repository import ROLES_COLLECTION, USER_ROLES_COLLECTION, MongoRoleRepository, MongoUserRoleRepository
from app.users.dependencies import get_role_repository, get_user_role_repository, get_user_service
from app.users.repository import USERS_COLLECTION, MongoUserRepository
from app.users.routes import add_users_routes
from app.users.service import UserService
from app.users.types import Action, Subject
from app.version.types import VersionInfo

_TEST_SECRET = "test-secret-key-long-enough-for-hs256"  # nosec B105
_DEPLOYMENT_MODULES = ["build-your-profile", "job-readiness"]


def _make_token(user_id: str = "u1", email: str = "user@example.com", name: str | None = "Test User") -> str:
    claims = {"sub": user_id, "email": email, "firebase": {"sign_in_provider": "password"}}
    if name is not None:
        claims["name"] = name
    return pyjwt.encode(claims, key=_TEST_SECRET, algorithm="HS256")


def _auth(user_id: str = "u1", name: str | None = "Test User") -> dict:
    return {"Authorization": f"Bearer {_make_token(user_id=user_id, name=name)}"}


async def _seed_user(db, user_id: str = "u1", **overrides) -> None:
    doc = {"user_id": user_id, "email": f"{user_id}@example.com", "name": "Test User"}
    doc.update(overrides)
    await db[USERS_COLLECTION].insert_one(doc)


async def _seed_role(db, name: str, permissions: list[dict]) -> str:
    """Insert a role document; returns its string _id."""
    doc = {
        "name": name,
        "label": name.capitalize(),
        "description": f"{name} role",
        "permissions": permissions,
        "assignable": True,
    }
    result = await db[ROLES_COLLECTION].insert_one(doc)
    return str(result.inserted_id)


async def _seed_user_role(db, user_id: str, role_id: str, institution_id: str | None = None) -> str:
    """Insert a user_role document; returns its string _id."""
    result = await db[USER_ROLES_COLLECTION].insert_one({
        "user_id": user_id,
        "role_id": role_id,
        "institution_id": institution_id,
        "granted_by": None,
        "granted_at": None,
    })
    return str(result.inserted_id)


def _make_app(db, monkeypatch) -> FastAPI:
    monkeypatch.setenv("TARGET_ENVIRONMENT_TYPE", "local")
    app = FastAPI()
    auth = Authentication()
    add_users_routes(app, auth)

    role_repo = MongoRoleRepository(db)
    user_role_repo = MongoUserRoleRepository(db)

    def _make_service():
        return UserService(
            repository=MongoUserRepository(db),
            role_repository=role_repo,
            user_role_repository=user_role_repo,
        )

    app.dependency_overrides[get_user_service] = _make_service
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
        active_modules=_DEPLOYMENT_MODULES,
    ))

    db = in_memory_analytics_database
    app = _make_app(db, monkeypatch)

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        c.db = db
        yield c

    clear_enforcer_cache()
    clear_application_config()


class TestGetMe:
    async def test_returns_401_without_auth(self, client):
        assert (await client.get("/api/me")).status_code == 401

    async def test_returns_404_when_not_provisioned(self, client):
        assert (await client.get("/api/me", headers=_auth())).status_code == 404

    async def test_returns_profile_with_permissions_and_scope(self, client):
        await _seed_user(client.db, "u1")
        role_id = await _seed_role(client.db, "funder", [
            {"subject": "dashboard", "action": "view"},
            {"subject": "account", "action": "view"},
        ])
        await _seed_user_role(client.db, "u1", role_id)

        body = (await client.get("/api/me", headers=_auth())).json()

        assert body["user_id"] == "u1"
        assert "dashboard:view" in body["permissions"]
        assert "account:view" in body["permissions"]
        assert body["scope"]["type"] == "all"
        assert body["active_modules"] == _DEPLOYMENT_MODULES

    async def test_returns_role_name(self, client):
        await _seed_user(client.db, "u1")
        role_id = await _seed_role(client.db, "funder", [{"subject": "dashboard", "action": "view"}])
        await _seed_user_role(client.db, "u1", role_id)

        body = (await client.get("/api/me", headers=_auth())).json()

        assert body["role"] == "funder"

    async def test_returns_null_role_when_no_roles_assigned(self, client):
        await _seed_user(client.db, "u1")

        body = (await client.get("/api/me", headers=_auth())).json()

        assert body["role"] is None

    async def test_prefers_jwt_identity_over_stored_copy(self, client):
        await _seed_user(client.db, "u1", email="stale@example.com", name="Stale")

        body = (await client.get("/api/me", headers=_auth())).json()

        assert body["email"] == "user@example.com"
        assert body["name"] == "Test User"

    async def test_returns_institutions_scope_for_institution_scoped_role(self, client):
        await _seed_user(client.db, "u1")
        role_id = await _seed_role(client.db, "implementer", [{"subject": "dashboard", "action": "view"}])
        await _seed_user_role(client.db, "u1", role_id, institution_id="inst-a")

        body = (await client.get("/api/me", headers=_auth())).json()

        assert body["scope"]["type"] == "institutions"
        assert body["scope"]["institution_ids"] == ["inst-a"]


class TestRegister:
    async def test_creates_a_profile_that_get_me_can_then_read(self, client):
        response = await client.post("/api/users/register", headers=_auth())

        assert response.status_code == 201
        assert (await client.get("/api/me", headers=_auth())).status_code == 200

    async def test_returns_401_without_auth(self, client):
        assert (await client.post("/api/users/register")).status_code == 401

    async def test_persists_the_organization_given_in_the_body(self, client):
        response = await client.post("/api/users/register", headers=_auth(), json={"organization": "Acme Corp"})
        assert response.status_code == 201

        body = (await client.get("/api/me", headers=_auth())).json()
        assert body["organization"] == "Acme Corp"

    async def test_a_later_login_does_not_erase_the_organization_set_at_registration(self, client):
        await client.post("/api/users/register", headers=_auth(), json={"organization": "Acme Corp"})

        response = await client.post("/api/users/register", headers=_auth())
        assert response.status_code == 201

        body = (await client.get("/api/me", headers=_auth())).json()
        assert body["organization"] == "Acme Corp"

    async def test_persists_the_name_given_in_the_body_for_a_password_account_with_no_name_claim(self, client):
        no_name_auth = _auth(name=None)

        response = await client.post("/api/users/register", headers=no_name_auth, json={"name": "Kunda Tembo"})
        assert response.status_code == 201

        body = (await client.get("/api/me", headers=no_name_auth)).json()
        assert body["name"] == "Kunda Tembo"

    async def test_a_later_login_does_not_erase_the_name_set_by_an_earlier_edit(self, client):
        no_name_auth = _auth(name=None)
        await client.post("/api/users/register", headers=no_name_auth, json={"name": "Kunda Tembo"})

        response = await client.post("/api/users/register", headers=no_name_auth)
        assert response.status_code == 201

        body = (await client.get("/api/me", headers=no_name_auth)).json()
        assert body["name"] == "Kunda Tembo"


class TestListRoles:
    async def test_returns_401_without_auth(self, client):
        assert (await client.get("/api/roles")).status_code == 401

    async def test_returns_403_without_access_management_permission(self, client):
        # u1 has only dashboard:view, not access-management:manage
        await _seed_user(client.db, "u1")
        role_id = await _seed_role(client.db, "viewer", [{"subject": "dashboard", "action": "view"}])
        await _seed_user_role(client.db, "u1", role_id)

        assert (await client.get("/api/roles", headers=_auth())).status_code == 403

    async def test_returns_roles_for_authorized_caller(self, client):
        await _seed_user(client.db, "u1")
        role_id = await _seed_role(client.db, "admin", [{"subject": "access-management", "action": "manage"}])
        await _seed_user_role(client.db, "u1", role_id)
        await _seed_role(client.db, "viewer", [{"subject": "dashboard", "action": "view"}])

        body = (await client.get("/api/roles", headers=_auth())).json()

        assert isinstance(body, list)
        names = {r["name"] for r in body}
        assert "admin" in names
        assert "viewer" in names


class TestListUsers:
    async def test_returns_401_without_auth(self, client):
        assert (await client.get("/api/users")).status_code == 401

    async def test_returns_403_without_access_management_permission(self, client):
        await _seed_user(client.db, "u1")
        role_id = await _seed_role(client.db, "viewer", [{"subject": "dashboard", "action": "view"}])
        await _seed_user_role(client.db, "u1", role_id)

        assert (await client.get("/api/users", headers=_auth())).status_code == 403

    async def test_returns_users_with_roles_for_authorized_caller(self, client):
        await _seed_user(client.db, "u1")
        await _seed_user(client.db, "u2")
        role_id = await _seed_role(client.db, "admin", [{"subject": "access-management", "action": "manage"}])
        await _seed_user_role(client.db, "u1", role_id)

        body = (await client.get("/api/users", headers=_auth())).json()

        assert isinstance(body, list)
        user_ids = {u["user_id"] for u in body}
        assert "u1" in user_ids
        assert "u2" in user_ids
        u1 = next(u for u in body if u["user_id"] == "u1")
        assert any(r["role_name"] == "admin" for r in u1["roles"])

    async def test_users_with_no_assignments_have_empty_roles_list(self, client):
        await _seed_user(client.db, "u1")
        role_id = await _seed_role(client.db, "admin", [{"subject": "access-management", "action": "manage"}])
        await _seed_user_role(client.db, "u1", role_id)
        await _seed_user(client.db, "u2")

        body = (await client.get("/api/users", headers=_auth())).json()

        u2 = next(u for u in body if u["user_id"] == "u2")
        assert u2["roles"] == []


class TestAssignRole:
    async def test_returns_401_without_auth(self, client):
        assert (await client.post("/api/users/u2/roles", json={"role_id": "x", "institution_id": None})).status_code == 401

    async def test_returns_403_without_access_management_permission(self, client):
        await _seed_user(client.db, "u1")
        role_id = await _seed_role(client.db, "viewer", [{"subject": "dashboard", "action": "view"}])
        await _seed_user_role(client.db, "u1", role_id)

        response = await client.post(
            "/api/users/u2/roles",
            json={"role_id": role_id, "institution_id": None},
            headers=_auth(),
        )
        assert response.status_code == 403

    async def test_assigns_role_and_returns_201(self, client):
        await _seed_user(client.db, "u1")
        role_id = await _seed_role(client.db, "admin", [{"subject": "access-management", "action": "manage"}])
        await _seed_user_role(client.db, "u1", role_id)
        target_role_id = await _seed_role(client.db, "implementer", [{"subject": "dashboard", "action": "view"}])

        response = await client.post(
            "/api/users/u2/roles",
            json={"role_id": target_role_id, "institution_id": "inst-a"},
            headers=_auth(),
        )

        assert response.status_code == 201
        body = response.json()
        assert body["role_id"] == target_role_id
        assert body["institution_id"] == "inst-a"
        assert body["role_name"] == "implementer"

    async def test_role_takes_effect_immediately_for_the_target_user(self, client):
        await _seed_user(client.db, "u1")
        await _seed_user(client.db, "u2")
        role_id = await _seed_role(client.db, "admin", [{"subject": "access-management", "action": "manage"}])
        await _seed_user_role(client.db, "u1", role_id)
        impl_role_id = await _seed_role(client.db, "implementer", [{"subject": "dashboard", "action": "view"}])

        await client.post(
            "/api/users/u2/roles",
            json={"role_id": impl_role_id, "institution_id": "inst-a"},
            headers=_auth(),
        )

        me = await client.get("/api/me", headers=_auth(user_id="u2"))
        assert me.status_code == 200
        body = me.json()
        assert body["scope"] == {"type": "institutions", "institution_ids": ["inst-a"]}

    async def test_returns_422_for_unknown_role_id(self, client):
        await _seed_user(client.db, "u1")
        role_id = await _seed_role(client.db, "admin", [{"subject": "access-management", "action": "manage"}])
        await _seed_user_role(client.db, "u1", role_id)

        response = await client.post(
            "/api/users/u2/roles",
            json={"role_id": str(ObjectId()), "institution_id": None},
            headers=_auth(),
        )

        assert response.status_code == 422


class TestRevokeRole:
    async def test_returns_401_without_auth(self, client):
        assert (await client.delete("/api/users/u2/roles/some-id")).status_code == 401

    async def test_returns_403_without_access_management_permission(self, client):
        await _seed_user(client.db, "u1")
        role_id = await _seed_role(client.db, "viewer", [{"subject": "dashboard", "action": "view"}])
        await _seed_user_role(client.db, "u1", role_id)

        assert (await client.delete("/api/users/u2/roles/some-id", headers=_auth())).status_code == 403

    async def test_revokes_user_role_and_returns_204(self, client):
        await _seed_user(client.db, "u1")
        await _seed_user(client.db, "u2")
        role_id = await _seed_role(client.db, "admin", [{"subject": "access-management", "action": "manage"}])
        await _seed_user_role(client.db, "u1", role_id)
        impl_role_id = await _seed_role(client.db, "implementer", [{"subject": "dashboard", "action": "view"}])
        user_role_id = await _seed_user_role(client.db, "u2", impl_role_id)

        response = await client.delete(f"/api/users/u2/roles/{user_role_id}", headers=_auth())

        assert response.status_code == 204

    async def test_returns_404_for_nonexistent_user_role(self, client):
        await _seed_user(client.db, "u1")
        role_id = await _seed_role(client.db, "admin", [{"subject": "access-management", "action": "manage"}])
        await _seed_user_role(client.db, "u1", role_id)

        response = await client.delete("/api/users/u2/roles/no-such-id", headers=_auth())

        assert response.status_code == 404

    async def test_revoked_role_no_longer_grants_access(self, client):
        await _seed_user(client.db, "u1")
        await _seed_user(client.db, "u2")
        role_id = await _seed_role(client.db, "admin", [{"subject": "access-management", "action": "manage"}])
        await _seed_user_role(client.db, "u1", role_id)
        impl_role_id = await _seed_role(client.db, "implementer", [{"subject": "dashboard", "action": "view"}])
        user_role_id = await _seed_user_role(client.db, "u2", impl_role_id)

        # First confirm u2 has the permissions
        me_before = (await client.get("/api/me", headers=_auth(user_id="u2"))).json()
        assert "dashboard:view" in me_before["permissions"]

        # Revoke
        await client.delete(f"/api/users/u2/roles/{user_role_id}", headers=_auth())

        # Now u2 has no permissions
        me_after = (await client.get("/api/me", headers=_auth(user_id="u2"))).json()
        assert me_after["permissions"] == []
