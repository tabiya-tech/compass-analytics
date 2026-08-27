from datetime import date
from typing import Annotated, Literal

from fastapi import Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

from app.shared.filters import INSTITUTION_IDS_PARAM, Granularity, InvalidFiltersError

# One chart per demographic dimension (gender, region, ...); the list grows with no schema
# change. `type` is constrained so an unrecognised shape fails validation, not a wrong guess.
ChartType = Literal["pie-chart", "horizontal-bar-chart"]


class DemographicsFilters(BaseModel):
    """Like AnalyticsFilters, minus audience_segment/login_method — nothing uses either yet."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    start_date: date = Field(description="Inclusive start of the reporting window (yyyy-MM-dd)")
    end_date: date = Field(description="Inclusive end of the reporting window (yyyy-MM-dd)")
    granularity: Granularity = Field(
        description="Accepted and forwarded for an upcoming date-scoped demographics feature; not yet bucketed upstream"
    )
    institution_id: str | None = Field(
        default=None,
        description="Drill down to a single institution. Omitted means every institution the caller may see.",
    )

    @field_validator("institution_id")
    @classmethod
    def _reject_blank_institution_id(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("institution_id must not be blank — omit it to include every institution")
        return value

    @model_validator(mode="after")
    def _validate_date_range(self) -> "DemographicsFilters":
        if self.start_date > self.end_date:
            raise ValueError("start_date must be on or before end_date")
        return self

    def to_upstream_params(self, institution_ids: list[str] | None = None) -> dict[str, str]:
        params = {
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "granularity": self.granularity,
        }
        if institution_ids:
            params[INSTITUTION_IDS_PARAM] = ",".join(institution_ids)
        return params


def _demographics_filters_dep(
    request: Request,
    start_date: date = Query(..., description="Inclusive start of the reporting window (yyyy-MM-dd)"),
    end_date: date = Query(..., description="Inclusive end of the reporting window (yyyy-MM-dd)"),
    granularity: Granularity = Query(
        ...,
        description="Accepted and forwarded for an upcoming date-scoped demographics feature; not yet bucketed upstream",
    ),
    institution_id: str | None = Query(
        default=None,
        description="Drill down to a single institution. Omitted means every institution the caller may see.",
    ),
) -> DemographicsFilters:
    # FastAPI hands this function only the parameters declared above, so `extra="forbid"`
    # never sees an unknown one — it would be silently ignored rather than refused. Check
    # the raw query string for it, so a misspelled filter is still a loud 422.
    unknown = sorted(set(request.query_params) - set(DemographicsFilters.model_fields))
    if unknown:
        raise InvalidFiltersError([
            {
                "type": "extra_forbidden",
                "loc": ("query", name),
                "msg": "Extra inputs are not permitted",
                "input": request.query_params[name],
            }
            for name in unknown
        ])

    try:
        return DemographicsFilters(
            start_date=start_date,
            end_date=end_date,
            granularity=granularity,
            institution_id=institution_id,
        )
    except ValidationError as exc:
        raise InvalidFiltersError(exc.errors()) from exc


#: Resolved through a Depends() function that declares each field as its own Query param —
#: same reason as `AnalyticsFiltersDep`. Annotating the model directly (`Annotated[Model,
#: Query()]`) makes FastAPI emit a single object-typed `$ref` parameter, which has no
#: Swagger 2.0 equivalent, so the IAC converter produces a config GCP API Gateway rejects.
DemographicsFiltersDep = Annotated[DemographicsFilters, Depends(_demographics_filters_dep)]


class DemographicItem(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    name: str
    value: int = Field(ge=0)


class DemographicChart(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    type: ChartType
    name: str
    items: list[DemographicItem]


class DemographicsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    charts: list[DemographicChart]
    degraded: bool
