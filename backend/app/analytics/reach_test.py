"""
End-to-end tests for GET /api/analytics/reach.

Uses httpx.AsyncClient with ASGI transport so the Motor DB fixture and the
route handler share the same asyncio event loop (TestClient uses a sync thread
bridge which causes a different-loop error with Motor).

Authentication uses local mode (TARGET_ENVIRONMENT_TYPE=local), so any
HS256-signed JWT is accepted without signature verification — same behaviour
as running the server locally.
"""
import httpx
import jwt as pyjwt
import pytest
from fastapi import FastAPI

from app.analytics.dependencies import get_analytics_service
from app.analytics.repositories import StubAnalyticsRepository
from app.analytics.routes import add_analytics_routes
from app.analytics.services import AnalyticsService
from app.auth.firebase import Authentication

_TEST_SECRET = "test-secret-key-long-enough-for-hs256"


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


@pytest.fixture()
async def async_client(monkeypatch):
    # GIVEN the server runs in local mode (no Firebase signature verification)
    monkeypatch.setenv("TARGET_ENVIRONMENT_TYPE", "local")

    app = FastAPI()
    auth = Authentication()
    add_analytics_routes(app, auth)

    service = AnalyticsService(repository=StubAnalyticsRepository())
    app.dependency_overrides[get_analytics_service] = lambda: service

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        yield client


def _reach_url(start: str, end: str, granularity: str = "month", **kwargs) -> str:
    params = f"start_date={start}&end_date={end}&granularity={granularity}"
    for k, v in kwargs.items():
        params += f"&{k}={v}"
    return f"/api/analytics/reach?{params}"


class TestReachAuth:
    async def test_should_reject_request_with_no_auth_header(self, async_client):
        # GIVEN no Authorization header is sent

        # WHEN the reach endpoint is called without a token
        actual_response = await async_client.get(_reach_url("2026-01-01", "2026-06-30"))

        # THEN expect the request to be rejected with 401
        assert actual_response.status_code == 401

    async def test_should_reject_request_with_an_invalid_token(self, async_client):
        # GIVEN an invalid (non-JWT) bearer token
        given_headers = {"Authorization": "Bearer not-a-jwt"}

        # WHEN the reach endpoint is called with the invalid token
        actual_response = await async_client.get(
            _reach_url("2026-01-01", "2026-06-30"),
            headers=given_headers,
        )

        # THEN expect the request to be rejected with 401
        assert actual_response.status_code == 401


class TestReachResponse:
    async def test_should_return_200_with_valid_token_and_params(self, async_client):
        # GIVEN a valid Firebase token and valid date range params

        # WHEN the reach endpoint is called
        actual_response = await async_client.get(_reach_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)

        # THEN expect a successful response
        assert actual_response.status_code == 200

    async def test_should_include_summary_and_series_in_response(self, async_client):
        # GIVEN a valid request

        # WHEN the reach endpoint is called
        actual_body = (await async_client.get(_reach_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)).json()

        # THEN expect the response to contain both summary and series sections
        assert "summary" in actual_body
        assert "series" in actual_body

    async def test_should_include_all_required_summary_fields(self, async_client):
        # GIVEN a valid request

        # WHEN the reach endpoint is called
        actual_summary = (
            await async_client.get(_reach_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()["summary"]

        # THEN expect all required summary fields to be present
        assert all(
            k in actual_summary
            for k in ("total_users", "active_users_30d", "total_logins", "avg_logins_per_user", "avg_session_minutes")
        )

    async def test_should_return_positive_summary_values(self, async_client):
        # GIVEN a valid request

        # WHEN the reach endpoint is called
        actual_summary = (
            await async_client.get(_reach_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()["summary"]

        # THEN expect all key counts to be positive numbers
        assert actual_summary["total_users"] > 0
        assert actual_summary["total_logins"] > 0
        assert actual_summary["active_users_30d"] > 0

    async def test_should_include_all_required_fields_in_each_series_point(self, async_client):
        # GIVEN a valid request

        # WHEN the reach endpoint is called
        actual_series = (
            await async_client.get(_reach_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()["series"]

        # THEN expect at least one point in the series
        assert len(actual_series) > 0
        # AND each point to have all required fields
        for point in actual_series:
            assert all(k in point for k in ("label", "cumulative", "added", "new_users", "returning", "logins"))

    async def test_should_produce_one_point_per_month_for_monthly_granularity(self, async_client):
        # GIVEN a 6-month date range with monthly granularity

        # WHEN the reach endpoint is called
        actual_series = (
            await async_client.get(_reach_url("2026-01-01", "2026-06-30", granularity="month"), headers=_AUTH_HEADER)
        ).json()["series"]

        # THEN expect exactly 6 data points — one per month
        assert len(actual_series) == 6

    async def test_should_produce_one_point_per_day_for_daily_granularity(self, async_client):
        # GIVEN a 7-day date range with daily granularity

        # WHEN the reach endpoint is called
        actual_series = (
            await async_client.get(_reach_url("2026-06-01", "2026-06-07", granularity="day"), headers=_AUTH_HEADER)
        ).json()["series"]

        # THEN expect exactly 7 data points — one per day
        assert len(actual_series) == 7

    async def test_should_return_identical_data_on_repeated_calls(self, async_client):
        # GIVEN the same query parameters for two separate requests

        # WHEN the reach endpoint is called twice
        given_url = _reach_url("2026-01-01", "2026-03-31", granularity="month")
        actual_first = (await async_client.get(given_url, headers=_AUTH_HEADER)).json()
        actual_second = (await async_client.get(given_url, headers=_AUTH_HEADER)).json()

        # THEN expect both responses to be identical (stub data is deterministic)
        assert actual_first == actual_second


class TestReachValidation:
    async def test_should_return_422_when_required_params_are_missing(self, async_client):
        # GIVEN no query parameters

        # WHEN the reach endpoint is called without required params
        actual_response = await async_client.get("/api/analytics/reach", headers=_AUTH_HEADER)

        # THEN expect a validation error
        assert actual_response.status_code == 422

    async def test_should_return_422_for_invalid_granularity_value(self, async_client):
        # GIVEN an unsupported granularity value
        given_url = _reach_url("2026-01-01", "2026-06-30", granularity="quarter")

        # WHEN the reach endpoint is called with the invalid value
        actual_response = await async_client.get(given_url, headers=_AUTH_HEADER)

        # THEN expect a validation error
        assert actual_response.status_code == 422
