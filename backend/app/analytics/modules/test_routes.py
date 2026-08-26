"""
End-to-end tests for GET /api/modules/{module_key}.
"""
import json

import httpx
import jwt as pyjwt
import pytest

from app.shared.filters import AudienceSegment
from typing import get_args

_A_VALID_AUDIENCE_SEGMENT = get_args(AudienceSegment)[0]

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

_STUB_JOB_READINESS_PAYLOAD = {
    "started_percentage": 34.0,
    "sub_modules": [
        {"id": "cv-builder", "name": "CV Builder", "started": 1200, "completed": 900},
        {"id": "interview-prep", "name": "Interview Prep", "started": 1500, "completed": 980},
    ],
    "degraded": False,
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


def _routing_transport():
    """Returns the correct stub payload based on the upstream path."""
    def handler(request):
        if "job-readiness" in request.url.path:
            body = json.dumps(_STUB_JOB_READINESS_PAYLOAD).encode()
        else:
            body = json.dumps(_STUB_BYP_PAYLOAD).encode()
        return httpx.Response(200, content=body, headers={"content-type": "application/json"})
    return httpx.MockTransport(handler)


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


class _RecordingTransport(httpx.MockTransport):
    def __init__(self, payload: dict):
        self.request: httpx.Request | None = None
        body = json.dumps(payload).encode()

        def handler(request):
            self.request = request
            return httpx.Response(200, content=body, headers={"content-type": "application/json"})

        super().__init__(handler)

    @property
    def upstream_params(self) -> dict[str, str]:
        assert self.request is not None, "upstream was never called"
        return dict(self.request.url.params)

    @property
    def upstream_path(self) -> str:
        assert self.request is not None, "upstream was never called"
        return self.request.url.path


def _module_url(module_key: str, start: str, end: str, granularity: str = "month", **kwargs) -> str:
    params = f"start_date={start}&end_date={end}&granularity={granularity}"
    for k, v in kwargs.items():
        params += f"&{k}={v}"
    return f"/api/modules/{module_key}?{params}"


@pytest.fixture()
async def client_with_data(make_modules_client):
    return await make_modules_client(_routing_transport())


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


@pytest.fixture()
async def byp_recording_upstream(make_modules_client):
    transport = _RecordingTransport(_STUB_BYP_PAYLOAD)
    return await make_modules_client(transport), transport


@pytest.fixture()
async def jr_recording_upstream(make_modules_client):
    transport = _RecordingTransport(_STUB_JOB_READINESS_PAYLOAD)
    return await make_modules_client(transport), transport


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
        # GIVEN module_key=build-your-profile

        # WHEN the modules endpoint is called
        actual_response = await client_with_data.get(
            _module_url("build-your-profile", "2026-01-01", "2026-06-30"), headers=_AUTH_HEADER
        )

        # THEN expect a successful response
        assert actual_response.status_code == 200

    async def test_should_return_200_for_job_readiness(self, client_with_data):
        # GIVEN module_key=job-readiness

        # WHEN the modules endpoint is called
        actual_response = await client_with_data.get(
            _module_url("job-readiness", "2026-01-01", "2026-06-30"), headers=_AUTH_HEADER
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


class TestJobReadinessResponse:
    async def test_should_include_required_fields_in_response(self, client_with_data):
        # GIVEN a valid request

        # WHEN the endpoint is called
        actual_body = (
            await client_with_data.get(
                _module_url("job-readiness", "2026-01-01", "2026-06-30"), headers=_AUTH_HEADER
            )
        ).json()

        # THEN the response contains the expected top-level fields
        assert "started_percentage" in actual_body
        assert "sub_modules" in actual_body
        assert "degraded" in actual_body

    async def test_should_return_data_from_compass_api(self, client_with_data):
        # GIVEN the Compass API returns stub data

        # WHEN the endpoint is called
        actual_body = (
            await client_with_data.get(
                _module_url("job-readiness", "2026-01-01", "2026-06-30"), headers=_AUTH_HEADER
            )
        ).json()

        # THEN the response values match what Compass returned
        assert actual_body["started_percentage"] == 34.0
        assert len(actual_body["sub_modules"]) == 2
        assert actual_body["degraded"] is False

    async def test_should_resolve_job_readiness_to_the_correct_upstream_path(self, jr_recording_upstream):
        # GIVEN a request for job-readiness
        client, transport = jr_recording_upstream

        # WHEN the endpoint is called
        await client.get(_module_url("job-readiness", "2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)

        # THEN upstream is called at the job-readiness analytics path
        assert transport.upstream_path == "/analytics/modules/job-readiness"


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


class TestJobReadinessWhenApiUnavailable:
    async def test_should_return_200_with_empty_data_when_compass_api_is_unreachable(self, client_no_api):
        # GIVEN the Compass API is unreachable

        # WHEN the endpoint is called
        actual_response = await client_no_api.get(
            _module_url("job-readiness", "2026-01-01", "2026-06-30"),
            headers=_AUTH_HEADER,
        )

        # THEN expect a successful response (not a 5xx)
        assert actual_response.status_code == 200

    async def test_should_return_degraded_flag_when_compass_api_is_unreachable(self, client_no_api):
        # GIVEN the Compass API is unreachable

        # WHEN the endpoint is called
        actual_body = (
            await client_no_api.get(
                _module_url("job-readiness", "2026-01-01", "2026-06-30"), headers=_AUTH_HEADER
            )
        ).json()

        # THEN the degraded flag is set and data is zeroed
        assert actual_body["degraded"] is True
        assert actual_body["started_percentage"] == 0.0
        assert actual_body["sub_modules"] == []


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

    async def test_should_return_422_when_start_date_is_after_end_date(self, client_with_data):
        # GIVEN a date range whose start falls after its end
        given_url = _module_url("job-readiness", "2026-06-30", "2026-01-01")

        # WHEN the endpoint is called
        actual_response = await client_with_data.get(given_url, headers=_AUTH_HEADER)

        # THEN expect a validation error with an explanatory message
        assert actual_response.status_code == 422
        assert "start_date must be on or before end_date" in actual_response.text

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
            audience_segment=_A_VALID_AUDIENCE_SEGMENT, login_method="google", institution_id="aW5zdGl0dXRpb24",
        )

        # WHEN the modules endpoint is called
        await client.get(url, headers=_AUTH_HEADER)

        # THEN every filter is forwarded to the upstream Compass call
        assert captured == [{
            "start_date": "2026-01-01",
            "end_date": "2026-06-30",
            "granularity": "week",
            "audience_segment": _A_VALID_AUDIENCE_SEGMENT,
            "login_method": "google",
            "institution_ids": "aW5zdGl0dXRpb24",
        }]

    async def test_should_forward_resolved_scope_not_raw_institution_id_for_job_readiness(self, jr_recording_upstream):
        # GIVEN a request drilling down to one institution for job-readiness
        client, transport = jr_recording_upstream
        given_url = _module_url("job-readiness", "2026-01-01", "2026-06-30", institution_id="inst-1")

        # WHEN the endpoint is called
        await client.get(given_url, headers=_AUTH_HEADER)

        # THEN upstream sees the resolved institution_ids, not the raw institution_id
        actual_params = transport.upstream_params
        assert actual_params["institution_ids"] == "inst-1"
        assert "institution_id" not in actual_params

    async def test_should_omit_optional_filters_when_not_given_for_job_readiness(self, jr_recording_upstream):
        # GIVEN a request with only required filters
        client, transport = jr_recording_upstream

        # WHEN the endpoint is called
        await client.get(_module_url("job-readiness", "2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)

        # THEN upstream receives only the required filters
        assert transport.upstream_params == {
            "start_date": "2026-01-01",
            "end_date": "2026-06-30",
            "granularity": "month",
        }


class TestModulesDoesNotAffectReach:
    async def test_reach_endpoint_still_works_after_registering_modules(self, client_with_data):
        # GIVEN both the reach and modules routers are registered on the same app (see conftest)

        # WHEN the pre-existing /api/reach endpoint is called
        actual_response = await client_with_data.get(
            "/api/reach?start_date=2026-01-01&end_date=2026-06-30&granularity=month", headers=_AUTH_HEADER
        )

        # THEN it still responds successfully — adding module_key support left it unaffected
        assert actual_response.status_code == 200
