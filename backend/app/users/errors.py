from pydantic import Field

from app.errors import HTTPErrorResponse


class UserNotProvisionedError(Exception):
    """The caller is authenticated but has no record in the `users` collection."""


class ForbiddenInstitutionError(Exception):
    """The caller requested an institution outside their granted scope."""


class UnknownRoleError(Exception):
    """The requested role name does not exist in ROLES."""


class GrantNotFoundError(Exception):
    """The requested grant does not exist."""


class UserNotProvisionedErrorResponse(HTTPErrorResponse):
    detail: str = Field(description="The authenticated user has no provisioned profile in the system.")


class NotProvisionedForbiddenErrorResponse(HTTPErrorResponse):
    detail: str = Field(description="The caller is authenticated but has not been provisioned with access to this resource.")
