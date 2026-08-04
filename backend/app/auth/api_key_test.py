import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth.api_key import ApiKeyAuth, ExternalService

_COMPASS_KEY = "compass-secret"
_KEYS = {ExternalService.COMPASS: _COMPASS_KEY}


@pytest.fixture()
def client() -> TestClient:
    app = FastAPI()
    auth = ApiKeyAuth(keys=_KEYS)

    @app.get("/protected")
    def protected(_: None = Depends(auth.require())):
        return {"ok": True}

    return TestClient(app, raise_server_exceptions=True)


class TestApiKeyAuthRequire:
    def test_should_allow_request_with_a_valid_key(self, client):
        # GIVEN a valid API key
        given_key = _COMPASS_KEY

        # WHEN the protected endpoint is called with the given key
        actual_response = client.get("/protected", headers={"X-API-Key": given_key})

        # THEN expect the request to be allowed
        assert actual_response.status_code == 200

    def test_should_reject_request_with_a_wrong_key(self, client):
        # GIVEN an invalid API key
        given_key = "wrong-key"

        # WHEN the protected endpoint is called with the given key
        actual_response = client.get("/protected", headers={"X-API-Key": given_key})

        # THEN expect the request to be rejected with 401
        assert actual_response.status_code == 401

    def test_should_reject_request_with_no_key_header(self, client):
        # GIVEN no API key header is sent

        # WHEN the protected endpoint is called without the header
        actual_response = client.get("/protected")

        # THEN expect the request to be rejected with 401
        assert actual_response.status_code == 401


class TestApiKeyAuthKeyFor:
    def test_should_return_the_key_for_a_known_service(self):
        # GIVEN an auth instance configured with a Compass key
        given_auth = ApiKeyAuth(keys=_KEYS)

        # WHEN the key for the Compass service is requested
        actual_key = given_auth.key_for(ExternalService.COMPASS)

        # THEN expect the returned key to match the configured key
        assert actual_key == _COMPASS_KEY

    def test_should_raise_for_a_service_with_no_configured_key(self):
        # GIVEN an auth instance whose internal key registry has been cleared
        # (simulates a service added to the enum but not yet configured in the environment)
        given_auth = ApiKeyAuth(keys=_KEYS)
        given_auth._keys = {}

        # WHEN the key for the Compass service is requested
        # THEN expect a KeyError to be raised
        with pytest.raises(KeyError):
            given_auth.key_for(ExternalService.COMPASS)


class TestApiKeyAuthValidation:
    def test_should_raise_when_constructed_with_an_empty_keys_dict(self):
        # GIVEN an empty keys dict

        # WHEN ApiKeyAuth is constructed with no keys
        # THEN expect a ValueError to be raised
        with pytest.raises(ValueError, match="At least one"):
            ApiKeyAuth(keys={})

    def test_should_raise_when_a_service_key_value_is_empty(self):
        # GIVEN a keys dict with an empty value for Compass
        given_keys = {ExternalService.COMPASS: ""}

        # WHEN ApiKeyAuth is constructed with the given keys
        # THEN expect a ValueError to be raised
        with pytest.raises(ValueError, match="must not be empty"):
            ApiKeyAuth(keys=given_keys)
