"""
End-to-end tests for GET /api/me.

Uses httpx.AsyncClient with ASGI transport plus the in-memory Motor database
fixture, so the route reads a real (ephemeral) `users` collection. Auth runs in
local mode (TARGET_ENVIRONMENT_TYPE=local): any HS256-signed JWT is accepted
without signature verification, matching local server behaviour.
"""
import httpx
import jwt as pyjwt
import pytest
from fastapi import FastAPI

from app.auth.firebase import Authentication
from app.users.dependencies import get_user_service
from app.users.repository import USERS_COLLECTION, MongoUserRepository
from app.users.routes import add_users_routes
from app.users.service import UserService

_TEST_SECRET = "test-secret-key-long-enough-for-hs256"  # nosec B105 — HS256 signing key for forged test JWTs, not a credential


def _make_firebase_token(user_id: str = "u1", email: str = "user@example.com") -> str:
    claims = {
        "sub": user_id,
        "email": email,
        "name": "Test User",
        "firebase": {"sign_in_provider": "password"},
    }
    return pyjwt.encode(claims, key=_TEST_SECRET, algorithm="HS256")


def _auth_header(user_id: str = "u1") -> dict:
    return {"Authorization": f"Bearer {_make_firebase_token(user_id=user_id)}"}


@pytest.fixture()
async def client(monkeypatch, in_memory_analytics_database):
    # GIVEN the server runs in local mode against the in-memory users collection
    monkeypatch.setenv("TARGET_ENVIRONMENT_TYPE", "local")

    app = FastAPI()
    auth = Authentication()
    add_users_routes(app, auth)

    service = UserService(repository=MongoUserRepository(in_memory_analytics_database))
    app.dependency_overrides[get_user_service] = lambda: service

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        c.db = in_memory_analytics_database  # expose for seeding in tests
        yield c


async def _seed_user(db, **overrides) -> None:
    doc = {
        "user_id": "u1",
        "email": "provisioned@example.com",
        "name": "Provisioned Name",
        "role": "implementer",
        "scope_type": "institutions",
        "institution_ids": ["inst-a"],
        "active_modules": ["build-your-profile"],
    }
    doc.update(overrides)
    await db[USERS_COLLECTION].insert_one(doc)


class TestMeAuth:
    async def test_should_reject_request_with_no_auth_header(self, client):
        # GIVEN no Authorization header

        # WHEN /api/me is called without a token
        actual = await client.get("/api/me")

        # THEN it is rejected with 401
        assert actual.status_code == 401

    async def test_should_reject_request_with_an_invalid_token(self, client):
        # GIVEN a non-JWT bearer token

        # WHEN /api/me is called
        actual = await client.get("/api/me", headers={"Authorization": "Bearer not-a-jwt"})

        # THEN it is rejected with 401
        assert actual.status_code == 401


class TestMeResponse:
    async def test_should_return_profile_for_a_provisioned_user(self, client):
        # GIVEN a provisioned user
        await _seed_user(client.db)

        # WHEN /api/me is called
        actual = await client.get("/api/me", headers=_auth_header())

        # THEN a 200 with the resolved profile
        assert actual.status_code == 200
        body = actual.json()
        assert body["user_id"] == "u1"
        assert body["role"] == "implementer"
        assert body["scope"]["type"] == "institutions"
        assert body["scope"]["institution_ids"] == ["inst-a"]
        assert body["active_modules"] == ["build-your-profile"]

    async def test_should_prefer_jwt_identity_over_stored_copy(self, client):
        # GIVEN a record whose stored identity differs from the JWT
        await _seed_user(client.db, email="stale@example.com", name="Stale")

        # WHEN /api/me is called
        body = (await client.get("/api/me", headers=_auth_header())).json()

        # THEN the JWT identity is returned
        assert body["email"] == "user@example.com"
        assert body["name"] == "Test User"


class TestMeNotProvisioned:
    async def test_should_return_404_when_user_has_no_record(self, client):
        # GIVEN no users record for the caller (first login)

        # WHEN /api/me is called
        actual = await client.get("/api/me", headers=_auth_header())

        # THEN it returns 404 (provisioning pending)
        assert actual.status_code == 404
