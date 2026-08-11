"""
End-to-end tests for GET /api/reach.

Uses httpx.AsyncClient with ASGI transport so the Motor DB fixture and the
route handler share the same asyncio event loop (TestClient uses a sync thread
bridge which causes a different-loop error with Motor).

Authentication uses local mode (TARGET_ENVIRONMENT_TYPE=local), so any
HS256-signed JWT is accepted without signature verification — same behaviour
as running the server locally.

The Compass API is not available in tests, so we use httpx.MockTransport to
control what the repository's http client receives. Tests that expect empty
data simply let the transport raise a connection error (API unavailable).
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

_STUB_REACH_PAYLOAD = {
    "summary": {
        "total_users": 5000,
        "active_users_30d": 1200,
        "total_logins": 20000,
        "avg_logins_per_user": 4.0,
        "avg_session_minutes": 18,
    },
    "series": [
        {"label": "Jan", "cumulative": 5000, "added": 500, "new_users": 400, "returning": 100, "logins": 800},
    ],
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


def _reach_url(start: str, end: str, granularity: str = "month", **kwargs) -> str:
    params = f"start_date={start}&end_date={end}&granularity={granularity}"
    for k, v in kwargs.items():
        params += f"&{k}={v}"
    return f"/api/reach?{params}"


@pytest.fixture()
async def client_with_data(make_reach_client):
    return await make_reach_client(_make_mock_transport(_STUB_REACH_PAYLOAD))


@pytest.fixture()
async def client_no_api(make_reach_client):
    return await make_reach_client(_make_mock_transport(None))


class TestReachAuth:
    async def test_should_reject_request_with_no_auth_header(self, client_with_data):
        # GIVEN no Authorization header is sent

        # WHEN the reach endpoint is called without a token
        actual_response = await client_with_data.get(_reach_url("2026-01-01", "2026-06-30"))

        # THEN expect the request to be rejected with 401
        assert actual_response.status_code == 401

    async def test_should_reject_request_with_an_invalid_token(self, client_with_data):
        # GIVEN an invalid (non-JWT) bearer token
        given_headers = {"Authorization": "Bearer not-a-jwt"}

        # WHEN the reach endpoint is called with the invalid token
        actual_response = await client_with_data.get(
            _reach_url("2026-01-01", "2026-06-30"),
            headers=given_headers,
        )

        # THEN expect the request to be rejected with 401
        assert actual_response.status_code == 401


class TestReachResponse:
    async def test_should_return_200_with_valid_token_and_params(self, client_with_data):
        # GIVEN a valid Firebase token and valid date range params

        # WHEN the reach endpoint is called
        actual_response = await client_with_data.get(_reach_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)

        # THEN expect a successful response
        assert actual_response.status_code == 200

    async def test_should_include_summary_and_series_in_response(self, client_with_data):
        # GIVEN a valid request

        # WHEN the reach endpoint is called
        actual_body = (await client_with_data.get(_reach_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)).json()

        # THEN expect the response to contain both summary and series sections
        assert "summary" in actual_body
        assert "series" in actual_body

    async def test_should_include_all_required_summary_fields(self, client_with_data):
        # GIVEN a valid request

        # WHEN the reach endpoint is called
        actual_summary = (
            await client_with_data.get(_reach_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()["summary"]

        # THEN expect all required summary fields to be present
        assert all(
            k in actual_summary
            for k in ("total_users", "active_users_30d", "total_logins", "avg_logins_per_user", "avg_session_minutes")
        )

    async def test_should_return_data_from_compass_api(self, client_with_data):
        # GIVEN the Compass API returns stub data

        # WHEN the reach endpoint is called
        actual_summary = (
            await client_with_data.get(_reach_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()["summary"]

        # THEN expect the summary values to match what the Compass API returned
        assert actual_summary["total_users"] == 5000
        assert actual_summary["active_users_30d"] == 1200

    async def test_should_include_all_required_fields_in_each_series_point(self, client_with_data):
        # GIVEN a valid request

        # WHEN the reach endpoint is called
        actual_series = (
            await client_with_data.get(_reach_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()["series"]

        # THEN expect at least one point in the series
        assert len(actual_series) > 0
        # AND each point to have all required fields
        for point in actual_series:
            assert all(k in point for k in ("label", "cumulative", "added", "new_users", "returning", "logins"))


class TestReachWhenApiUnavailable:
    async def test_should_return_200_with_empty_data_when_compass_api_is_unreachable(self, client_no_api):
        # GIVEN the Compass API is unreachable

        # WHEN the reach endpoint is called
        actual_response = await client_no_api.get(_reach_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)

        # THEN expect a successful response (not an error)
        assert actual_response.status_code == 200

    async def test_should_return_zero_summary_when_compass_api_is_unreachable(self, client_no_api):
        # GIVEN the Compass API is unreachable

        # WHEN the reach endpoint is called
        actual_summary = (
            await client_no_api.get(_reach_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()["summary"]

        # THEN expect all summary values to be zero
        assert actual_summary["total_users"] == 0
        assert actual_summary["total_logins"] == 0

    async def test_should_return_empty_series_when_compass_api_is_unreachable(self, client_no_api):
        # GIVEN the Compass API is unreachable

        # WHEN the reach endpoint is called
        actual_series = (
            await client_no_api.get(_reach_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()["series"]

        # THEN expect an empty series
        assert actual_series == []


class TestReachValidation:
    async def test_should_return_422_when_required_params_are_missing(self, client_with_data):
        # GIVEN no query parameters

        # WHEN the reach endpoint is called without required params
        actual_response = await client_with_data.get("/api/reach", headers=_AUTH_HEADER)

        # THEN expect a validation error
        assert actual_response.status_code == 422

    async def test_should_return_422_for_invalid_granularity_value(self, client_with_data):
        # GIVEN an unsupported granularity value
        given_url = _reach_url("2026-01-01", "2026-06-30", granularity="quarter")

        # WHEN the reach endpoint is called with the invalid value
        actual_response = await client_with_data.get(given_url, headers=_AUTH_HEADER)

        # THEN expect a validation error
        assert actual_response.status_code == 422
