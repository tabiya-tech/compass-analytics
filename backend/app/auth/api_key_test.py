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
    def test_allows_compass_key(self, client):
        response = client.get("/protected", headers={"X-API-Key": _COMPASS_KEY})
        assert response.status_code == 200

    def test_rejects_wrong_key(self, client):
        response = client.get("/protected", headers={"X-API-Key": "wrong-key"})
        assert response.status_code == 401

    def test_rejects_missing_header(self, client):
        response = client.get("/protected")
        assert response.status_code == 401


class TestApiKeyAuthKeyFor:
    def test_returns_key_for_known_service(self):
        auth = ApiKeyAuth(keys=_KEYS)
        assert auth.key_for(ExternalService.COMPASS) == _COMPASS_KEY

    def test_raises_for_unconfigured_service(self):
        # Start with a valid instance, then clear _keys to simulate a service
        # added to the enum but not yet configured in the environment.
        auth = ApiKeyAuth(keys=_KEYS)
        auth._keys = {}
        with pytest.raises(KeyError):
            auth.key_for(ExternalService.COMPASS)


class TestApiKeyAuthValidation:
    def test_raises_on_empty_keys_dict(self):
        with pytest.raises(ValueError, match="At least one"):
            ApiKeyAuth(keys={})

    def test_raises_on_empty_key_value(self):
        with pytest.raises(ValueError, match="must not be empty"):
            ApiKeyAuth(keys={ExternalService.COMPASS: ""})
