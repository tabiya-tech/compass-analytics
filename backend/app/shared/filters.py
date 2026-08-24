"""
The filter contract every module's endpoints share.

Reach, jobseekers, institutions and the module-engagement endpoints all take the same
filter set, so it is defined **once** here rather than re-declared per module:
`AnalyticsFilters` is the request contract, and `AnalyticsFiltersDep` is what a route
annotates its `filters` argument with.

A module that needs an extra filter extends the contract rather than replacing it — see
`AnalyticsFilters` for the two lines that takes.

Module-specific request and response models stay in that module's own package (e.g.
`app/analytics/reach/types.py`, `app/jobseekers/types.py`); this package is only for what
is genuinely shared across modules.
"""
from collections.abc import Mapping
from datetime import date
from typing import Annotated, Any, ClassVar, Literal, TypeVar

from fastapi import Query
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

# ---- Vocabulary shared with the frontend ----
# These mirror frontend/src/shared/filters/filterParams.types.ts one-for-one; a value
# added on one side has to be added on the other, or the frontend can send a filter the
# API rejects with a 422.

Granularity = Literal["day", "week", "month"]
AudienceSegment = Literal["job-seekers"]
LoginMethod = Literal["email", "google", "anonymous"]

#: Upstream takes the *resolved* institution scope under this name — see `to_upstream_params`.
INSTITUTION_IDS_PARAM = "institution_ids"


def _to_param(value: Any) -> str:
    """One value, rendered the way the upstream query string expects it."""
    if isinstance(value, bool):
        # str(True) is "True"; upstream reads lowercase JSON-ish booleans.
        return "true" if value else "false"
    if isinstance(value, (list, tuple, set)):
        return ",".join(str(item) for item in value)
    return str(value)


class AnalyticsFilters(BaseModel):
    """
    The filter set every endpoint accepts.

    Required: `start_date`, `end_date`, `granularity`.
    Optional: `audience_segment`, `login_method`, `institution_id` — omitted means "no
    narrowing on that dimension", and an omitted filter is never sent upstream at all
    (rather than sent as an empty value, which upstream would read as a real filter).

    `extra="forbid"` makes a misspelled query parameter a loud 422 instead of a filter
    that silently does nothing. `frozen=True` means a route hands the same object down to
    the service and repository knowing nothing can rewrite it on the way.

    To extend for a module::

        class JobseekerAnalyticsFilters(AnalyticsFilters):
            module_id: ModuleId | None = None

    The date/vocabulary validation and the upstream serialisation below both work off the
    model's fields, so a subclass gets them for its new fields for free.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    #: Fields that must never be forwarded verbatim. `institution_id` is what the caller
    #: *asked* for; the service replaces it with the scope their grant actually allows
    #: (see ReachService.get_reach), so forwarding the raw ask would leak the narrowing.
    #: A subclass adds to this set rather than replacing it.
    UPSTREAM_EXCLUDED_FIELDS: ClassVar[frozenset[str]] = frozenset({"institution_id"})

    start_date: date = Field(description="Inclusive start of the reporting window (yyyy-MM-dd)")
    end_date: date = Field(description="Inclusive end of the reporting window (yyyy-MM-dd)")
    granularity: Granularity = Field(description="Size of each time bucket in the returned series")
    audience_segment: AudienceSegment | None = Field(default=None, description="Narrow to one audience segment")
    login_method: LoginMethod | None = Field(default=None, description="Narrow to one sign-in method")
    institution_id: str | None = Field(
        default=None,
        description="Drill down to a single institution. Omitted means every institution the caller may see.",
    )

    @field_validator("institution_id")
    @classmethod
    def _reject_blank_institution_id(cls, value: str | None) -> str | None:
        # `?institution_id=` arrives as "" — a filter for an institution named nothing,
        # which would silently return an empty dashboard. Omission is how you mean "all".
        if value is not None and not value.strip():
            raise ValueError("institution_id must not be blank — omit it to include every institution")
        return value

    @model_validator(mode="after")
    def _validate_date_range(self) -> "AnalyticsFilters":
        if self.start_date > self.end_date:
            raise ValueError("start_date must be on or before end_date")
        return self

    def to_upstream_params(self, institution_ids: list[str] | None = None) -> dict[str, str]:
        """
        Render the filters as the upstream Compass query string.

        Every repository forwards through this one method so the wire format cannot drift
        between endpoints. `institution_ids` is the scope the service resolved: `None` (or
        empty) means "every institution the caller may see" and sends nothing, which is
        what upstream reads as unrestricted.
        """
        dumped = self.model_dump(mode="json", exclude_none=True, exclude=set(self.UPSTREAM_EXCLUDED_FIELDS))
        params = {key: _to_param(value) for key, value in dumped.items()}
        if institution_ids:
            params[INSTITUTION_IDS_PARAM] = ",".join(institution_ids)
        return params


FiltersT = TypeVar("FiltersT", bound=AnalyticsFilters)


class InvalidFiltersError(RequestValidationError):
    """
    Raised by `verify_basic_filters`.

    It subclasses FastAPI's `RequestValidationError`, so the built-in handler renders it as
    a 422 with the same body shape as a filter rejected by `AnalyticsFiltersDep` — a route
    needs no try/except, and the frontend sees one error format either way.
    """


def verify_basic_filters(
    candidate: AnalyticsFilters | Mapping[str, Any],
    model: type[FiltersT] = AnalyticsFilters,  # type: ignore[assignment]
) -> FiltersT:
    """
    Check a filter set before anything is done with it, and hand back the parsed model.

    Call this at the point of integration — the top of a route handler, or a service reached
    from somewhere other than an HTTP route — so a bad filter is refused before any query
    runs. It applies the rules declared on the model: required bounds present and real
    calendar dates, `start_date` on or before `end_date`, values from the shared
    vocabularies, no blank `institution_id`, and no unknown filter.

    `candidate` is either raw query parameters (a mapping) or an already-parsed model.
    Verifying something already parsed is deliberately allowed and cheap: it costs one
    re-validation and means a caller never has to know which of the two it is holding.

    A module with an extended contract passes its own subclass as `model`, e.g.
    ``verify_basic_filters(raw_params, JobseekerAnalyticsFilters)``.

    :raises InvalidFiltersError: rendered by FastAPI as a 422 listing every field at fault.
    """
    payload = candidate.model_dump() if isinstance(candidate, AnalyticsFilters) else dict(candidate)
    try:
        return model.model_validate(payload)
    except ValidationError as exc:
        raise InvalidFiltersError(exc.errors()) from exc


#: What a route annotates its filters argument with, e.g.
#: ``async def get_reach(filters: AnalyticsFiltersDep, ...)``. FastAPI reads the model's
#: fields as query parameters and turns any validation failure into a 422 itself, so no
#: route needs a hand-written parsing dependency.
AnalyticsFiltersDep = Annotated[AnalyticsFilters, Query()]
