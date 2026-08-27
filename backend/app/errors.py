from pydantic import BaseModel, Field


class HTTPErrorResponse(BaseModel):
    detail: str


class ForbiddenInstitutionErrorResponse(HTTPErrorResponse):
    detail: str = Field(description="The caller does not have access to the requested institution.")
