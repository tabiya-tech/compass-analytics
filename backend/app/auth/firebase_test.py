import base64
import json

import jwt as pyjwt
import pytest
from fastapi import HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials

from app.auth.firebase import Authentication, SignInProvider, UserInfo, _get_user_info

_TEST_SECRET = "test-secret-key-long-enough-for-hs256"  # nosec B105 — HS256 signing key for forged test JWTs, not a credential


def _make_token(claims: dict) -> str:
    return pyjwt.encode(claims, key=_TEST_SECRET, algorithm="HS256")


class TestGetUserInfo:
    def test_should_map_standard_firebase_claims_to_user_info(self):
        # GIVEN a decoded Firebase token with standard claims
        given_token = _make_token({
            "sub": "uid-1",
            "email": "alice@example.com",
            "name": "Alice",
            "firebase": {"sign_in_provider": "password"},
        })
        given_claims = {
            "sub": "uid-1",
            "email": "alice@example.com",
            "name": "Alice",
            "firebase": {"sign_in_provider": "password"},
        }

        # WHEN the user info is extracted from the decoded token
        actual_user_info = _get_user_info(given_claims, given_token)

        # THEN expect the user info to match the token claims
        assert actual_user_info.user_id == "uid-1"
        assert actual_user_info.email == "alice@example.com"
        assert actual_user_info.name == "Alice"
        assert actual_user_info.sign_in_provider == SignInProvider.PASSWORD

    def test_should_return_none_for_email_and_name_when_user_is_anonymous(self):
        # GIVEN a decoded Firebase token for an anonymous user (no email or name)
        given_claims = {"sub": "anon-1", "firebase": {"sign_in_provider": "anonymous"}}
        given_token = _make_token(given_claims)

        # WHEN the user info is extracted from the decoded token
        actual_user_info = _get_user_info(given_claims, given_token)

        # THEN expect the email and name to be None
        assert actual_user_info.email is None
        assert actual_user_info.name is None
        # AND the sign-in provider to be anonymous
        assert actual_user_info.sign_in_provider == SignInProvider.ANONYMOUS

    def test_should_map_google_sign_in_provider(self):
        # GIVEN a decoded Firebase token from a Google sign-in
        given_claims = {
            "sub": "g-1",
            "email": "g@gmail.com",
            "name": "G User",
            "firebase": {"sign_in_provider": "google.com"},
        }
        given_token = _make_token(given_claims)

        # WHEN the user info is extracted from the decoded token
        actual_user_info = _get_user_info(given_claims, given_token)

        # THEN expect the sign-in provider to be Google
        assert actual_user_info.sign_in_provider == SignInProvider.GOOGLE


def _bearer(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def _make_request(headers: dict | None = None) -> Request:
    scope = {"type": "http", "headers": [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]}
    return Request(scope)


def _call_dependency(auth: Authentication, credentials: HTTPAuthorizationCredentials,
                     headers: dict | None = None) -> UserInfo:
    """Invoke the actual FastAPI dependency callable."""
    return auth.get_user_info()(request=_make_request(headers), credentials=credentials)


class TestAuthenticationLocal:
    def test_should_decode_unsigned_jwt_and_return_user_info_in_local_mode(self):
        # GIVEN local mode (env passed explicitly, no signature verification)
        given_auth = Authentication(environment_type="local")
        # AND a self-signed JWT
        given_token = _make_token({
            "sub": "uid-local",
            "email": "local@example.com",
            "name": "Local User",
            "firebase": {"sign_in_provider": "password"},
        })

        # WHEN the auth dependency resolves the request
        actual_user_info = _call_dependency(given_auth, _bearer(given_token))

        # THEN expect the mapped UserInfo (dependency, not a raw decode)
        assert actual_user_info.user_id == "uid-local"
        assert actual_user_info.email == "local@example.com"
        assert actual_user_info.sign_in_provider == SignInProvider.PASSWORD

    def test_should_401_when_local_token_is_not_a_jwt(self):
        # GIVEN local mode
        given_auth = Authentication(environment_type="local")

        # WHEN a non-JWT bearer token is presented
        # THEN the dependency raises 401 (the except-Exception → 401 path)
        with pytest.raises(HTTPException) as exc_info:
            _call_dependency(given_auth, _bearer("not-a-jwt"))
        assert exc_info.value.status_code == 401

    def test_should_default_unknown_environment_to_verifying_mode(self):
        # GIVEN a misspelled environment type (should NOT be treated as local)
        given_auth = Authentication(firebase_project_id="p", environment_type="Local")

        # WHEN a self-signed token is presented, verification is attempted (and
        # fails since it isn't a real Firebase token) → 401, NOT a silent accept.
        with pytest.raises(HTTPException) as exc_info:
            _call_dependency(given_auth, _bearer(_make_token({"sub": "x", "firebase": {"sign_in_provider": "password"}})))
        assert exc_info.value.status_code == 401


def _make_api_gateway_header(claims: dict) -> str:
    """Encode claims as the API Gateway does in x-apigateway-api-userinfo (no padding)."""
    return base64.b64encode(json.dumps(claims).encode()).decode().rstrip("=")


class TestAuthenticationProduction:
    def test_should_read_user_info_from_api_gateway_header_in_non_local_mode(self):
        # GIVEN a non-local environment
        given_auth = Authentication(firebase_project_id="my-project", environment_type="prod")
        # AND the API Gateway has validated the JWT and forwarded decoded claims
        given_claims = {"sub": "uid-prod", "email": "prod@example.com", "firebase": {"sign_in_provider": "google.com"}}
        given_header = _make_api_gateway_header(given_claims)

        # WHEN the auth dependency resolves the request
        actual_user_info = _call_dependency(
            given_auth,
            _bearer("real-firebase-token"),
            headers={"x-apigateway-api-userinfo": given_header},
        )

        # THEN the mapped UserInfo comes back from the gateway header, not raw JWT verification
        assert actual_user_info.user_id == "uid-prod"
        assert actual_user_info.sign_in_provider == SignInProvider.GOOGLE

    def test_should_401_when_api_gateway_header_is_missing(self):
        # GIVEN a non-local environment but the x-apigateway-api-userinfo header is absent
        # (e.g. request bypassed the gateway — should never happen in prod)
        given_auth = Authentication(firebase_project_id="my-project", environment_type="prod")

        # WHEN the dependency resolves without the gateway header
        # THEN it raises 401
        with pytest.raises(HTTPException) as exc_info:
            _call_dependency(given_auth, _bearer("any-token"))
        assert exc_info.value.status_code == 401

    def test_should_401_when_api_gateway_header_is_malformed(self):
        # GIVEN a non-local environment with a corrupt gateway header
        given_auth = Authentication(firebase_project_id="my-project", environment_type="prod")

        # WHEN the dependency resolves with a non-JSON base64 payload
        with pytest.raises(HTTPException) as exc_info:
            _call_dependency(given_auth, _bearer("any-token"), headers={"x-apigateway-api-userinfo": "!!!notbase64!!!"})
        assert exc_info.value.status_code == 401
