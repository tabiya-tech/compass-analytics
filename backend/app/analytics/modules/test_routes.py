"""
End-to-end tests for GET /api/modules/{module_key}.
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

_STUB_BYP_PAYLOAD = {
    "summary": {
        "started_users": 500,
        "started_percentage": 50.0,
        "completed_users": 300,
        "avg_completion_minutes": 12.5,
    },
    "series": [
        {"label": "Jan", "started": 500, "completed": 300, "skills_reports_generated": 300, "skills_reports_downloaded": 200},
    ],
    "phases": [
        {"id": "intro", "reached": 500},
        {"id": "experiences", "reached": 420},
        {"id": "skills", "reached": 350},
        {"id": "completed", "reached": 300},
    ],
}


def _make_mock_transport(payload: dict | None = None, status_code: int = 200, unreachable: bool = False):
    if unreachable:
        def handler(_request):
            raise httpx.ConnectError("Compass API not available")
        return httpx.MockTransport(handler)

    body = b"" if payload is None else json.dumps(payload).encode()

    def success_handler(_request):
        return httpx.Response(status_code, content=body, headers={"content-type": "application/json"})

    return httpx.MockTransport(success_handler)


def _never_called_transport():
    def handler(_request):
        raise AssertionError("upstream should never be called for an unrecognised module_key")
    return httpx.MockTransport(handler)


def _capturing_transport(captured: list):
    """Records the upstream request's query params so tests can assert on what was forwarded."""
    def handler(request):
        captured.append(dict(request.url.params))
        return httpx.Response(200, json=_STUB_BYP_PAYLOAD)
    return httpx.MockTransport(handler)


def _module_url(module_key: str, start: str, end: str, granularity: str = "month", **kwargs) -> str:
    params = f"start_date={start}&end_date={end}&granularity={granularity}"
    for k, v in kwargs.items():
        params += f"&{k}={v}"
    return f"/api/modules/{module_key}?{params}"


@pytest.fixture()
async def client_with_data(make_modules_client):
    return await make_modules_client(_make_mock_transport(_STUB_BYP_PAYLOAD))


@pytest.fixture()
async def client_no_api(make_modules_client):
    return await make_modules_client(_make_mock_transport(unreachable=True))


@pytest.fixture()
async def client_empty_body(make_modules_client):
    return await make_modules_client(_make_mock_transport(payload=None))


@pytest.fixture()
async def client_malformed(make_modules_client):
    return await make_modules_client(_make_mock_transport(payload={"summary": {}}))


@pytest.fixture()
async def client_never_calls_upstream(make_modules_client):
    return await make_modules_client(_never_called_transport())


class TestModulesAuth:
    async def test_should_reject_request_with_no_auth_header(self, client_with_data):
        # GIVEN no Authorization header is sent

        # WHEN the modules endpoint is called without a token
        actual_response = await client_with_data.get(_module_url("build-your-profile", "2026-01-01", "2026-06-30"))

        # THEN expect the request to be rejected with 401
        assert actual_response.status_code == 401

    async def test_should_reject_request_with_an_invalid_token(self, client_with_data):
        # GIVEN an invalid (non-JWT) bearer token
        given_headers = {"Authorization": "Bearer not-a-jwt"}

        # WHEN the modules endpoint is called with the invalid token
        actual_response = await client_with_data.get(
            _module_url("build-your-profile", "2026-01-01", "2026-06-30"),
            headers=given_headers,
        )

        # THEN expect the request to be rejected with 401
        assert actual_response.status_code == 401


class TestModulesAllowList:
    async def test_should_return_404_for_an_unrecognised_module_key(self, client_never_calls_upstream):
        # GIVEN a module_key this backend has no analytics slice for

        # WHEN the modules endpoint is called with valid filter params
        actual_response = await client_never_calls_upstream.get(
            _module_url("not-a-real-module", "2026-01-01", "2026-06-30"), headers=_AUTH_HEADER
        )

        # THEN expect a 404 (and, via the fixture's transport, no upstream call was made)
        assert actual_response.status_code == 404

    async def test_should_return_200_for_build_your_profile(self, client_with_data):
        # GIVEN module_key=build-your-profile, the one supported key

        # WHEN the modules endpoint is called
        actual_response = await client_with_data.get(
            _module_url("build-your-profile", "2026-01-01", "2026-06-30"), headers=_AUTH_HEADER
        )

        # THEN expect a successful response
        assert actual_response.status_code == 200


class TestBuildYourProfileResponse:
    async def test_should_include_summary_series_and_degraded_flag(self, client_with_data):
        # GIVEN a valid request

        # WHEN the modules endpoint is called
        actual_body = (
            await client_with_data.get(_module_url("build-your-profile", "2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()

        # THEN expect the response to contain summary, series, phases, and a degraded flag
        assert "summary" in actual_body
        assert "series" in actual_body
        assert "phases" in actual_body
        assert actual_body["degraded"] is False

    async def test_should_forward_phases_from_the_compass_api_unchanged(self, client_with_data):
        # GIVEN the Compass API returns a 4-stage funnel

        # WHEN the modules endpoint is called
        actual_phases = (
            await client_with_data.get(_module_url("build-your-profile", "2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()["phases"]

        # THEN every stage is forwarded exactly as the upstream reported it
        assert actual_phases == [
            {"id": "intro", "reached": 500},
            {"id": "experiences", "reached": 420},
            {"id": "skills", "reached": 350},
            {"id": "completed", "reached": 300},
        ]

    async def test_should_return_data_from_compass_api(self, client_with_data):
        # GIVEN the Compass API returns stub data

        # WHEN the modules endpoint is called
        actual_summary = (
            await client_with_data.get(_module_url("build-your-profile", "2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()["summary"]

        # THEN expect the summary values to match what the Compass API returned
        assert actual_summary["started_users"] == 500
        assert actual_summary["completed_users"] == 300

    async def test_should_include_all_required_fields_in_each_series_point(self, client_with_data):
        # GIVEN a valid request

        # WHEN the modules endpoint is called
        actual_series = (
            await client_with_data.get(_module_url("build-your-profile", "2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()["series"]

        # THEN expect at least one point, with all required fields
        assert len(actual_series) > 0
        for point in actual_series:
            assert all(
                k in point for k in ("label", "started", "completed", "skills_reports_generated", "skills_reports_downloaded")
            )


class TestBuildYourProfileWhenApiUnavailable:
    async def test_should_return_200_with_zeroed_and_degraded_payload(self, client_no_api):
        # GIVEN the Compass API is unreachable

        # WHEN the modules endpoint is called
        actual_body = (
            await client_no_api.get(_module_url("build-your-profile", "2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()

        # THEN expect 200 with a zeroed summary, empty series/phases, and degraded=True
        assert actual_body["summary"]["started_users"] == 0
        assert actual_body["series"] == []
        assert all(stage["reached"] == 0 for stage in actual_body["phases"])
        assert actual_body["degraded"] is True


class TestBuildYourProfileWhenApiReturnsEmptyBody:
    async def test_should_return_200_zeroed_but_not_degraded(self, client_empty_body):
        # GIVEN the Compass API returns a successful, empty response (legitimately no data)

        # WHEN the modules endpoint is called
        actual_response = await client_empty_body.get(
            _module_url("build-your-profile", "2026-01-01", "2026-06-30"), headers=_AUTH_HEADER
        )
        actual_body = actual_response.json()

        # THEN expect 200 with zeroed data, but degraded=False since this wasn't a failure
        assert actual_response.status_code == 200
        assert actual_body["summary"]["started_users"] == 0
        assert actual_body["degraded"] is False


class TestBuildYourProfileWhenResponseIsMalformed:
    async def test_should_return_200_zeroed_and_degraded(self, client_malformed):
        # GIVEN the Compass API returns a payload that doesn't match the expected schema

        # WHEN the modules endpoint is called
        actual_body = (
            await client_malformed.get(_module_url("build-your-profile", "2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()

        # THEN expect 200 with zeroed data, and degraded=True since this is schema drift, not real data
        assert actual_body["summary"]["started_users"] == 0
        assert actual_body["degraded"] is True


class TestModulesValidation:
    async def test_should_return_422_when_required_params_are_missing(self, client_with_data):
        # GIVEN no query parameters

        # WHEN the modules endpoint is called without required params
        actual_response = await client_with_data.get("/api/modules/build-your-profile", headers=_AUTH_HEADER)

        # THEN expect a validation error
        assert actual_response.status_code == 422

    async def test_should_return_422_for_invalid_granularity_value(self, client_with_data):
        # GIVEN an unsupported granularity value
        given_url = _module_url("build-your-profile", "2026-01-01", "2026-06-30", granularity="quarter")

        # WHEN the modules endpoint is called with the invalid value
        actual_response = await client_with_data.get(given_url, headers=_AUTH_HEADER)

        # THEN expect a validation error
        assert actual_response.status_code == 422


class TestModulesFilterForwarding:
    async def test_forwards_all_filter_params_to_upstream(self, make_modules_client):
        # GIVEN a request with every optional filter set, plus an institution scope
        captured: list = []
        client = await make_modules_client(_capturing_transport(captured))
        url = _module_url(
            "build-your-profile", "2026-01-01", "2026-06-30", granularity="week",
            audience_segment="youth", login_method="google", institution_id="aW5zdGl0dXRpb24",
        )

        # WHEN the modules endpoint is called
        await client.get(url, headers=_AUTH_HEADER)

        # THEN every filter is forwarded to the upstream Compass call
        assert captured == [{
            "start_date": "2026-01-01",
            "end_date": "2026-06-30",
            "granularity": "week",
            "audience_segment": "youth",
            "login_method": "google",
            "institution_ids": "aW5zdGl0dXRpb24",
        }]


class TestModulesDoesNotAffectReach:
    async def test_reach_endpoint_still_works_after_registering_modules(self, client_with_data):
        # GIVEN both the reach and modules routers are registered on the same app (see conftest)

        # WHEN the pre-existing /api/reach endpoint is called
        actual_response = await client_with_data.get(
            "/api/reach?start_date=2026-01-01&end_date=2026-06-30&granularity=month", headers=_AUTH_HEADER
        )

        # THEN it still responds successfully — adding module_key support left it unaffected
        assert actual_response.status_code == 200
