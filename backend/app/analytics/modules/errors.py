from pydantic import Field

from app.errors import HTTPErrorResponse


class UnknownModuleErrorResponse(HTTPErrorResponse):
    detail: str = Field(description="The requested module key does not exist.")
