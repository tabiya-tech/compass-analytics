import jwt as pyjwt
import pytest
from fastapi import HTTPException
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


def _call_dependency(auth: Authentication, credentials: HTTPAuthorizationCredentials) -> UserInfo:
    """Invoke the actual FastAPI dependency callable (request is unused by it)."""
    return auth.get_user_info()(request=None, credentials=credentials)


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


class TestAuthenticationProduction:
    def test_should_verify_token_and_return_user_info_in_non_local_mode(self, mocker):
        # GIVEN a non-local environment with a project id
        given_auth = Authentication(firebase_project_id="my-project", environment_type="prod")
        # AND the Firebase verifier returns decoded claims
        verify = mocker.patch(
            "app.auth.firebase._verify_firebase_token",
            return_value={"sub": "uid-prod", "email": "prod@example.com", "firebase": {"sign_in_provider": "google.com"}},
        )

        # WHEN the auth dependency resolves the request
        actual_user_info = _call_dependency(given_auth, _bearer("real-firebase-token"))

        # THEN the verifier was called with the token + project id
        verify.assert_called_once_with("real-firebase-token", "my-project")
        # AND the mapped UserInfo comes back
        assert actual_user_info.user_id == "uid-prod"
        assert actual_user_info.sign_in_provider == SignInProvider.GOOGLE

    def test_should_401_in_non_local_mode_when_project_id_missing(self):
        # GIVEN a non-local environment with NO project id configured
        given_auth = Authentication(firebase_project_id=None, environment_type="prod")

        # WHEN a token is presented, the ValueError is mapped to 401
        with pytest.raises(HTTPException) as exc_info:
            _call_dependency(given_auth, _bearer("any-token"))
        assert exc_info.value.status_code == 401

    def test_should_401_when_verifier_raises(self, mocker):
        # GIVEN a non-local environment where verification raises
        given_auth = Authentication(firebase_project_id="my-project", environment_type="prod")
        mocker.patch("app.auth.firebase._verify_firebase_token", side_effect=ValueError("bad token"))

        # WHEN the dependency resolves the request
        # THEN the exception is mapped to 401
        with pytest.raises(HTTPException) as exc_info:
            _call_dependency(given_auth, _bearer("bad-token"))
        assert exc_info.value.status_code == 401
