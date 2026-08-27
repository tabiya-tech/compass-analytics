from pydantic import Field

from app.errors import HTTPErrorResponse


class InvalidTokenErrorResponse(HTTPErrorResponse):
    detail: str = Field(description="Missing or invalid Firebase authentication token.")
