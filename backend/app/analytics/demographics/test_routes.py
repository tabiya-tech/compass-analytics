"""End-to-end tests for GET /api/demographics. ASGI transport keeps Motor on one event loop; local-mode auth accepts any HS256 JWT; MockTransport stands in for Compass."""
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

_STUB_DEMOGRAPHICS_PAYLOAD = [
    {
        "type": "pie-chart",
        "name": "gender",
        "items": [
            {"name": "female", "value": 223},
            {"name": "male", "value": 223},
        ],
    },
    {
        "type": "horizontal-bar-chart",
        "name": "region",
        "items": [{"name": "Lusaka", "value": 223}],
    },
]


def _make_mock_transport(payload: list | None = None, status_code: int = 200):
    if payload is None:
        def handler(_request):
            raise httpx.ConnectError("Compass API not available")
        return httpx.MockTransport(handler)

    body = json.dumps(payload).encode()
    def handler(_request):
        return httpx.Response(status_code, content=body, headers={"content-type": "application/json"})
    return httpx.MockTransport(handler)


def _demographics_url(start: str, end: str, granularity: str = "month", **kwargs) -> str:
    params = f"start_date={start}&end_date={end}&granularity={granularity}"
    for k, v in kwargs.items():
        params += f"&{k}={v}"
    return f"/api/demographics?{params}"


@pytest.fixture()
async def client_with_data(make_demographics_client):
    return await make_demographics_client(_make_mock_transport(_STUB_DEMOGRAPHICS_PAYLOAD))


@pytest.fixture()
async def client_no_api(make_demographics_client):
    return await make_demographics_client(_make_mock_transport(None))


_PARTIALLY_INVALID_PAYLOAD = [
    _STUB_DEMOGRAPHICS_PAYLOAD[0],
    {"type": "horizontal-bar-chart", "name": "region", "items": [{"name": "Lusaka", "value": -1}]},
]


@pytest.fixture()
async def client_with_partial_bad_data(make_demographics_client):
    return await make_demographics_client(_make_mock_transport(_PARTIALLY_INVALID_PAYLOAD))


class _RecordingTransport(httpx.MockTransport):
    """Answers with the stub payload and keeps the upstream request, so a test can assert
    on the query string the filters were forwarded as."""

    def __init__(self):
        self.request: httpx.Request | None = None
        body = json.dumps(_STUB_DEMOGRAPHICS_PAYLOAD).encode()

        def handler(request):
            self.request = request
            return httpx.Response(200, content=body, headers={"content-type": "application/json"})

        super().__init__(handler)

    @property
    def upstream_params(self) -> dict[str, str]:
        assert self.request is not None, "upstream was never called"
        return dict(self.request.url.params)


@pytest.fixture()
async def recording_upstream(make_demographics_client):
    """Yields (client, transport) so a test can call the endpoint and read what upstream saw."""
    transport = _RecordingTransport()
    return await make_demographics_client(transport), transport


class TestDemographicsAuth:
    async def test_should_reject_request_with_no_auth_header(self, client_with_data):
        # GIVEN no Authorization header is sent

        # WHEN the demographics endpoint is called without a token
        actual_response = await client_with_data.get(_demographics_url("2026-01-01", "2026-06-30"))

        # THEN expect the request to be rejected with 401
        assert actual_response.status_code == 401

    async def test_should_reject_request_with_an_invalid_token(self, client_with_data):
        # GIVEN an invalid (non-JWT) bearer token
        given_headers = {"Authorization": "Bearer not-a-jwt"}

        # WHEN the demographics endpoint is called with the invalid token
        actual_response = await client_with_data.get(
            _demographics_url("2026-01-01", "2026-06-30"),
            headers=given_headers,
        )

        # THEN expect the request to be rejected with 401
        assert actual_response.status_code == 401


class TestDemographicsResponse:
    async def test_should_return_200_with_valid_token_and_params(self, client_with_data):
        # GIVEN a valid Firebase token and valid date range params

        # WHEN the demographics endpoint is called
        actual_response = await client_with_data.get(
            _demographics_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER
        )

        # THEN expect a successful response
        assert actual_response.status_code == 200

    async def test_should_include_charts_and_degraded_flag_in_response(self, client_with_data):
        # GIVEN a valid request

        # WHEN the demographics endpoint is called
        actual_body = (
            await client_with_data.get(_demographics_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()

        # THEN expect the response to contain both charts and a degraded flag
        assert "charts" in actual_body
        assert "degraded" in actual_body
        assert actual_body["degraded"] is False

    async def test_should_return_data_from_compass_api(self, client_with_data):
        # GIVEN the Compass API returns stub data

        # WHEN the demographics endpoint is called
        actual_charts = (
            await client_with_data.get(_demographics_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()["charts"]

        # THEN expect the charts to match what the Compass API returned
        assert actual_charts == _STUB_DEMOGRAPHICS_PAYLOAD

    async def test_should_include_all_required_fields_in_each_chart(self, client_with_data):
        # GIVEN a valid request

        # WHEN the demographics endpoint is called
        actual_charts = (
            await client_with_data.get(_demographics_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()["charts"]

        # THEN expect at least one chart in the response
        assert len(actual_charts) > 0
        # AND each chart to have all required fields
        for chart in actual_charts:
            assert all(k in chart for k in ("type", "name", "items"))
            for item in chart["items"]:
                assert all(k in item for k in ("name", "value"))


class TestDemographicsWhenApiUnavailable:
    async def test_should_return_200_with_empty_data_when_compass_api_is_unreachable(self, client_no_api):
        # GIVEN the Compass API is unreachable

        # WHEN the demographics endpoint is called
        actual_response = await client_no_api.get(_demographics_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)

        # THEN expect a successful response (not an error)
        assert actual_response.status_code == 200

    async def test_should_return_empty_charts_when_compass_api_is_unreachable(self, client_no_api):
        # GIVEN the Compass API is unreachable

        # WHEN the demographics endpoint is called
        actual_body = (
            await client_no_api.get(_demographics_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()

        # THEN expect an empty chart list
        assert actual_body["charts"] == []

    async def test_should_flag_the_response_as_degraded_when_compass_api_is_unreachable(self, client_no_api):
        # GIVEN the Compass API is unreachable

        # WHEN the demographics endpoint is called
        actual_body = (
            await client_no_api.get(_demographics_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()

        # THEN expect the degraded flag to be set, distinguishing an outage from real empty data
        assert actual_body["degraded"] is True


class TestDemographicsWhenOneChartIsMalformed:
    """One bad chart in the upstream payload must not cost every other, still-valid chart."""

    async def test_should_return_200_keeping_the_valid_charts(self, client_with_partial_bad_data):
        # GIVEN upstream returns one valid chart and one with an out-of-range value

        # WHEN the demographics endpoint is called
        actual_response = await client_with_partial_bad_data.get(
            _demographics_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER
        )

        # THEN expect a successful response, not an error
        assert actual_response.status_code == 200

    async def test_should_keep_the_valid_chart_and_drop_only_the_malformed_one(self, client_with_partial_bad_data):
        # GIVEN upstream returns one valid chart and one with an out-of-range value

        # WHEN the demographics endpoint is called
        actual_charts = (
            await client_with_partial_bad_data.get(_demographics_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()["charts"]

        # THEN the valid gender chart survives; the malformed region chart is dropped
        assert len(actual_charts) == 1
        assert actual_charts[0]["name"] == "gender"

    async def test_should_flag_the_response_as_degraded(self, client_with_partial_bad_data):
        # GIVEN upstream returns one valid chart and one with an out-of-range value

        # WHEN the demographics endpoint is called
        actual_body = (
            await client_with_partial_bad_data.get(_demographics_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)
        ).json()

        # THEN degraded is set, even though some charts came through fine
        assert actual_body["degraded"] is True


class TestDemographicsValidation:
    async def test_should_return_422_when_required_params_are_missing(self, client_with_data):
        # GIVEN no query parameters

        # WHEN the demographics endpoint is called without required params
        actual_response = await client_with_data.get("/api/demographics", headers=_AUTH_HEADER)

        # THEN expect a validation error
        assert actual_response.status_code == 422

    async def test_should_return_422_for_invalid_granularity_value(self, client_with_data):
        # GIVEN an unsupported granularity value
        given_url = _demographics_url("2026-01-01", "2026-06-30", granularity="quarter")

        # WHEN the demographics endpoint is called with the invalid value
        actual_response = await client_with_data.get(given_url, headers=_AUTH_HEADER)

        # THEN expect a validation error
        assert actual_response.status_code == 422

    async def test_should_return_422_when_start_date_is_after_end_date(self, client_with_data):
        # GIVEN a range whose start date falls after its end date
        given_url = _demographics_url("2026-06-30", "2026-01-01")

        # WHEN the demographics endpoint is called with that range
        actual_response = await client_with_data.get(given_url, headers=_AUTH_HEADER)

        # THEN expect a validation error
        assert actual_response.status_code == 422
        # AND the message to say which rule was broken, not just that something was invalid
        assert "start_date must be on or before end_date" in actual_response.text

    async def test_should_return_422_when_audience_segment_is_given(self, client_with_data):
        # GIVEN audience_segment — demographics doesn't accept it; nothing upstream honors it
        given_url = _demographics_url("2026-01-01", "2026-06-30", audience_segment="job-seekers")

        # WHEN the demographics endpoint is called with it
        actual_response = await client_with_data.get(given_url, headers=_AUTH_HEADER)

        # THEN expect a validation error, not a silently-ignored filter
        assert actual_response.status_code == 422

    async def test_should_return_422_when_login_method_is_given(self, client_with_data):
        # GIVEN login_method — demographics doesn't accept it; nothing upstream honors it
        given_url = _demographics_url("2026-01-01", "2026-06-30", login_method="google")

        # WHEN the demographics endpoint is called with it
        actual_response = await client_with_data.get(given_url, headers=_AUTH_HEADER)

        # THEN expect a validation error, not a silently-ignored filter
        assert actual_response.status_code == 422


class TestFilterForwarding:
    """Demographics only accepts the filters that actually narrow something."""

    async def test_should_forward_every_given_filter_to_upstream_unchanged(self, recording_upstream):
        # GIVEN a request that uses every filter demographics accepts
        client, transport = recording_upstream
        given_url = _demographics_url("2026-01-01", "2026-06-30", granularity="week", institution_id="inst-1")

        # WHEN the demographics endpoint is called
        await client.get(given_url, headers=_AUTH_HEADER)

        # THEN upstream receives each filter with the value that was sent in
        actual_params = transport.upstream_params
        assert actual_params["start_date"] == "2026-01-01"
        assert actual_params["end_date"] == "2026-06-30"
        assert actual_params["granularity"] == "week"

    async def test_should_send_no_value_upstream_for_an_omitted_optional_filter(self, recording_upstream):
        # GIVEN a request that omits every optional filter
        client, transport = recording_upstream

        # WHEN the demographics endpoint is called
        await client.get(_demographics_url("2026-01-01", "2026-06-30"), headers=_AUTH_HEADER)

        # THEN upstream is sent only the required filters — an omitted one is absent, not empty
        assert transport.upstream_params == {
            "start_date": "2026-01-01",
            "end_date": "2026-06-30",
            "granularity": "month",
        }

    async def test_should_forward_the_resolved_scope_rather_than_the_requested_institution(self, recording_upstream):
        # GIVEN a request drilling down to one institution
        client, transport = recording_upstream
        given_url = _demographics_url("2026-01-01", "2026-06-30", institution_id="inst-1")

        # WHEN the demographics endpoint is called
        await client.get(given_url, headers=_AUTH_HEADER)

        # THEN upstream is told the scope the service resolved from the caller's grant
        actual_params = transport.upstream_params
        assert actual_params["institution_ids"] == "inst-1"
        # AND never the unchecked ask itself
        assert "institution_id" not in actual_params
