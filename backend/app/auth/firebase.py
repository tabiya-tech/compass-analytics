import logging
import os
from enum import Enum
from typing import Any, Callable, Optional

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from common_libs.environment_settings.environment_type import EnvironmentType

logger = logging.getLogger(__name__)

_BEARER = HTTPBearer(scheme_name="firebase")


class SignInProvider(str, Enum):
    ANONYMOUS = "anonymous"
    PASSWORD = "password"  # nosec
    GOOGLE = "google.com"


class UserInfo(BaseModel):
    user_id: str
    name: Optional[str] = None
    email: Optional[str] = None
    token: str
    sign_in_provider: SignInProvider

    model_config = {"extra": "forbid"}


def _get_user_info(decoded_token: Any, token: str) -> UserInfo:
    return UserInfo(
        user_id=decoded_token["sub"],
        name=decoded_token.get("name"),
        email=decoded_token.get("email"),
        token=token,
        sign_in_provider=decoded_token["firebase"]["sign_in_provider"],
    )


def _verify_firebase_token(token: str, project_id: str) -> dict:
    from google.auth.transport import requests as google_requests  # type: ignore[import-untyped]
    from google.oauth2 import id_token as google_id_token  # type: ignore[import-untyped]

    return google_id_token.verify_firebase_token(token, google_requests.Request(), audience=project_id)


class Authentication:
    """
    Mirrors the compass Authentication class.

    - Local: decodes the Firebase JWT from the Authorization header without
      verifying the signature, so developers can use self-signed tokens.
    - All other environments: verifies the token against Firebase's public keys
      using google-auth.
    """

    def __init__(self, firebase_project_id: Optional[str] = None, environment_type: Optional[str] = None):
        self.provider = _BEARER
        self._firebase_project_id = firebase_project_id
        # Read from ApplicationConfig at construction (fail-fast) rather than
        # os.getenv per request; falls back to the env var only when not supplied
        # (e.g. tests that construct Authentication() directly). An unknown value
        # resolves to PROD (verifying), so a misspelling can't disable auth.
        raw_env = environment_type if environment_type is not None else os.getenv("TARGET_ENVIRONMENT_TYPE")
        self._environment_type = EnvironmentType.from_string(raw_env)

    def get_user_info(self) -> Callable[[Request, HTTPAuthorizationCredentials], UserInfo]:
        def construct_user_info(
            request: Request,  # noqa: ARG001
            credentials: HTTPAuthorizationCredentials = Depends(self.provider),
        ) -> UserInfo:
            token = credentials.credentials
            try:
                if self._environment_type == EnvironmentType.LOCAL:
                    if not token:
                        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized, missing credentials")
                    token_info = jwt.decode(token, options={"verify_signature": False})
                else:
                    if not self._firebase_project_id:
                        raise ValueError("FIREBASE_PROJECT_ID is required in non-local environments.")
                    token_info = _verify_firebase_token(token, self._firebase_project_id)

                return _get_user_info(token_info, token)

            except HTTPException:
                raise
            except Exception as exc:
                logger.warning("Error while getting user info: %s - %s", exc.__class__.__name__, exc)
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

        return construct_user_info
