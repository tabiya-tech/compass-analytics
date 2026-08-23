"""
End-to-end tests for GET /api/analytics/institutions.

Follows the same structure as test_routes.py for /api/reach — ASGI transport,
local-mode Firebase auth (no signature verification), httpx.MockTransport for
the upstream Compass API.
"""
import json

import httpx
import jwt as pyjwt
import pytest

_TEST_SECRET = "test-secret-key-long-enough-for-hs256"  # nosec B105 — HS256 signing key for forged test JWTs, not a credential


def _make_firebase_token(user_id: str = "u1", email: str = "user@example.com") -> str:
    claims = {
        "sub": user_id,
        "email": email,
        "name": "Test User",
        "firebase": {"sign_in_provider": "password"},
    }
    return pyjwt.encode(claims, key=_TEST_SECRET, algorithm="HS256")


_VALID_TOKEN = _make_firebase_token()
_AUTH_HEADER = {"Authorization": f"Bearer {_VALID_TOKEN}"}

_STUB_INSTITUTIONS_PAYLOAD = {
    "institutions": [
        {
            "institution_id": "inst-1",
            "institution_name": "Lusaka College",
            "registered_users": 1200,
            "active_users_7d": 340,
            "skills_discovery_started_pct": 72.5,
            "skills_discovery_completed_pct": 48.0,
            "career_readiness_started_pct": 60.0,
            "career_readiness_completed_pct": 35.0,
            "career_explorer_started_pct": 40.0,
        },
        {
            "institution_id": "inst-2",
            "institution_name": "Ndola Institute",
            "registered_users": 800,
            "active_users_7d": 210,
            "skills_discovery_started_pct": None,
            "skills_discovery_completed_pct": None,
            "career_readiness_started_pct": None,
            "career_readiness_completed_pct": None,
            "career_explorer_started_pct": None,
        },
    ]
}


def _make_mock_transport(payload: dict | None = None, status_code: int = 200):
    if payload is None:
        def handler(_request):
            raise httpx.ConnectError("Compass API not available")
        return httpx.MockTransport(handler)

    body = json.dumps(payload).encode()
    def handler(_request):
        return httpx.Response(status_code, content=body, headers={"content-type": "application/json"})
    return httpx.MockTransport(handler)


def _institutions_url(start: str, end: str, granularity: str = "month", **kwargs) -> str:
    params = f"start_date={start}&end_date={end}&granularity={granularity}"
    for k, v in kwargs.items():
        params += f"&{k}={v}"
    return f"/api/analytics/institutions?{params}"


@pytest.fixture()
async def client_with_data(make_institutions_client):
    return await make_institutions_client(_make_mock_transport(_STUB_INSTITUTIONS_PAYLOAD))


@pytest.fixture()
async def client_no_api(make_institutions_client):
    return await make_institutions_client(_make_mock_transport(None))


class TestInstitutionsAuth:
    async def test_should_reject_request_with_no_auth_header(self, client_with_data):
        # GIVEN no Authorization header is sent

        # WHEN the institutions endpoint is called without a token
        actual_response = await client_with_data.get(_institutions_url("2026-01-01", "2026-06-30"))

        # THEN expect the request to be rejected with 401
        assert actual_response.status_code == 401

    async def test_should_reject_request_with_an_invalid_token(self, client_with_data):
        # GIVEN an invalid (non-JWT) bearer token
        given_headers = {"Authorization": "Bearer not-a-jwt"}

        # WHEN the institutions endpoint is called with the invalid token
        actual_response = await client_with_data.get(
            _institutions_url("2026-01-01", "2026-06-30"),
            headers=given_headers,
        )

        # THEN expect the request to be rejected with 401
        assert actual_response.status_code == 401


class TestInstitutionsResponse:
    async def test_should_return_200_with_valid_token_and_params(self, client_with_data):
        # GIVEN a valid Firebase token and valid date range params

        # WHEN the institutions endpoint is called
        actual_response = await client_with_data.get(
            _institutions_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER
        )

        # THEN expect a successful response
        assert actual_response.status_code == 200

    async def test_should_include_institutions_list_in_response(self, client_with_data):
        # GIVEN a valid request

        # WHEN the institutions endpoint is called
        actual_body = (
            await client_with_data.get(_institutions_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()

        # THEN expect the response to contain the institutions list
        assert "institutions" in actual_body
        assert isinstance(actual_body["institutions"], list)

    async def test_should_include_all_required_fields_in_each_institution(self, client_with_data):
        # GIVEN a valid request

        # WHEN the institutions endpoint is called
        actual_institutions = (
            await client_with_data.get(_institutions_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()["institutions"]

        # THEN expect at least one institution in the list
        assert len(actual_institutions) > 0
        # AND each institution to have all required fields
        for inst in actual_institutions:
            assert all(k in inst for k in ("institution_id", "institution_name", "registered_users", "active_users_7d"))

    async def test_should_return_data_from_compass_api(self, client_with_data):
        # GIVEN the Compass API returns stub data

        # WHEN the institutions endpoint is called
        actual_institutions = (
            await client_with_data.get(_institutions_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()["institutions"]

        # THEN expect the values to match what the Compass API returned
        assert actual_institutions[0]["institution_id"] == "inst-1"
        assert actual_institutions[0]["registered_users"] == 1200
        assert actual_institutions[0]["active_users_7d"] == 340
        assert actual_institutions[1]["institution_id"] == "inst-2"


class TestInstitutionsWhenApiUnavailable:
    async def test_should_return_200_when_compass_api_is_unreachable(self, client_no_api):
        # GIVEN the Compass API is unreachable

        # WHEN the institutions endpoint is called
        actual_response = await client_no_api.get(
            _institutions_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER
        )

        # THEN expect a successful response (not an error)
        assert actual_response.status_code == 200

    async def test_should_return_empty_institutions_list_when_compass_api_is_unreachable(self, client_no_api):
        # GIVEN the Compass API is unreachable

        # WHEN the institutions endpoint is called
        actual_institutions = (
            await client_no_api.get(_institutions_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()["institutions"]

        # THEN expect an empty institutions list
        assert actual_institutions == []


class TestInstitutionsValidation:
    async def test_should_return_422_when_required_params_are_missing(self, client_with_data):
        # GIVEN no query parameters

        # WHEN the institutions endpoint is called without required params
        actual_response = await client_with_data.get("/api/analytics/institutions", headers=_AUTH_HEADER)

        # THEN expect a validation error
        assert actual_response.status_code == 422

    async def test_should_return_422_for_invalid_granularity_value(self, client_with_data):
        # GIVEN an unsupported granularity value
        given_url = _institutions_url("2026-01-01", "2026-06-30", granularity="quarter")

        # WHEN the institutions endpoint is called with the invalid value
        actual_response = await client_with_data.get(given_url, headers=_AUTH_HEADER)

        # THEN expect a validation error
        assert actual_response.status_code == 422
