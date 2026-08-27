from pydantic import Field

from app.errors import HTTPErrorResponse


class InsufficientPermissionsErrorResponse(HTTPErrorResponse):
    detail: str = Field(description="The caller does not have the required permission to perform this action.")


class GrantNotFoundErrorResponse(HTTPErrorResponse):
    detail: str = Field(description="No grant with the given ID exists for the specified user.")


class UnknownRoleErrorResponse(HTTPErrorResponse):
    detail: str = Field(description="The requested role name is not a known role in the system.")
