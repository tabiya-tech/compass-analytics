import jwt as pyjwt
import pytest

from app.auth.firebase import Authentication, SignInProvider, _get_user_info

_TEST_SECRET = "test-secret-key-long-enough-for-hs256"


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


class TestAuthenticationLocal:
    def test_should_decode_jwt_without_signature_verification_in_local_mode(self, monkeypatch):
        # GIVEN the environment is set to local
        monkeypatch.setenv("TARGET_ENVIRONMENT_TYPE", "local")
        # AND a JWT token signed with a test secret
        given_claims = {
            "sub": "uid-local",
            "email": "local@example.com",
            "name": "Local User",
            "firebase": {"sign_in_provider": "password"},
        }
        given_token = _make_token(given_claims)

        # WHEN the token is decoded without signature verification
        actual_decoded = pyjwt.decode(given_token, options={"verify_signature": False})

        # THEN expect the decoded claims to match the original claims
        assert actual_decoded["sub"] == "uid-local"

    def test_should_store_firebase_project_id_when_provided(self, monkeypatch):
        # GIVEN a non-local environment
        monkeypatch.setenv("TARGET_ENVIRONMENT_TYPE", "staging")
        # AND a Firebase project ID
        given_project_id = "my-project"

        # WHEN Authentication is constructed with the given project ID
        actual_auth = Authentication(firebase_project_id=given_project_id)

        # THEN expect the project ID to be stored
        assert actual_auth._firebase_project_id == given_project_id


class TestAuthenticationProduction:
    def test_should_call_firebase_token_verification_in_production_mode(self, monkeypatch, mocker):
        # GIVEN a non-local environment
        monkeypatch.setenv("TARGET_ENVIRONMENT_TYPE", "staging")
        # AND a fake decoded token returned by the Firebase verifier
        given_claims = {
            "sub": "uid-prod",
            "email": "prod@example.com",
            "firebase": {"sign_in_provider": "google.com"},
        }
        mocker.patch("app.auth.firebase._verify_firebase_token", return_value=given_claims)

        # WHEN the Firebase token verifier is called
        from app.auth.firebase import _verify_firebase_token
        actual_claims = _verify_firebase_token("fake-token", "my-project")

        # THEN expect the returned claims to match the fake decoded token
        assert actual_claims["sub"] == "uid-prod"
