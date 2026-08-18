import base64
import json
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


def _decode_api_gateway_user_info(auth_info_b64: str) -> dict:
    """
    Decodes the base64-encoded user info forwarded by API Gateway in x-apigateway-api-userinfo.
    The gateway omits padding, so we add it back before decoding.
    """
    padding_needed = len(auth_info_b64) % 4
    if padding_needed == 1:
        raise ValueError("Invalid base64 input: length is not compatible with base64 encoding")
    padded = auth_info_b64 + ("=" * (4 - padding_needed) if padding_needed else "")
    return json.loads(base64.b64decode(padded.encode("utf-8")).decode("utf-8"))


class Authentication:
    """
    - Local: decodes the Firebase JWT from the Authorization header without
      verifying the signature, so developers can use self-signed tokens.
    - All other environments: trusts the API Gateway, which has already verified
      the JWT and forwarded the decoded claims in x-apigateway-api-userinfo.
    """

    def __init__(self, firebase_project_id: Optional[str] = None, environment_type: Optional[str] = None):
        self.provider = _BEARER
        self._firebase_project_id = firebase_project_id
        raw_env = environment_type if environment_type is not None else os.getenv("TARGET_ENVIRONMENT_TYPE")
        self._environment_type = EnvironmentType.from_string(raw_env)

    def get_user_info(self) -> Callable[[Request, HTTPAuthorizationCredentials], UserInfo]:
        def construct_user_info(
            request: Request,
            credentials: HTTPAuthorizationCredentials = Depends(self.provider),
        ) -> UserInfo:
            token = credentials.credentials
            try:
                if self._environment_type == EnvironmentType.LOCAL:
                    if not token:
                        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized, missing credentials")
                    token_info = jwt.decode(token, options={"verify_signature": False})
                else:
                    # In deployed environments the API Gateway validates the JWT and forwards
                    # the decoded claims as base64 JSON in x-apigateway-api-userinfo.
                    auth_info_b64 = request.headers.get("x-apigateway-api-userinfo")
                    if not auth_info_b64:
                        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
                    token_info = _decode_api_gateway_user_info(auth_info_b64)

                return _get_user_info(token_info, token)

            except HTTPException:
                raise
            except Exception as exc:
                logger.warning("Error while getting user info: %s - %s", exc.__class__.__name__, exc)
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

        return construct_user_info
