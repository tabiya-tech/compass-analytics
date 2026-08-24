"""
Unit tests for the shared filter contract.

These cover the model in isolation — parsing, validation and upstream serialisation.
The route-level behaviour (a bad filter becoming a 422, a good one reaching upstream)
is covered in app/analytics/reach/test_routes.py, against a real endpoint.
"""
from datetime import date
from typing import Literal, get_args

import httpx
import pytest
from fastapi import FastAPI
from pydantic import ValidationError

from app.shared.filters import (
    AudienceSegment,
    AnalyticsFilters,
    Granularity,
    InvalidFiltersError,
    LoginMethod,
    verify_basic_filters,
)

# Derived from the contract itself rather than restated, so adding a value to a vocabulary
# extends its test instead of leaving a stale list behind.
_GRANULARITIES = get_args(Granularity)
_AUDIENCE_SEGMENTS = get_args(AudienceSegment)
_LOGIN_METHODS = get_args(LoginMethod)

_GIVEN_START = date(2026, 1, 1)
_GIVEN_END = date(2026, 6, 30)


def _given_filters(**overrides) -> AnalyticsFilters:
    return AnalyticsFilters(
        **{
            "start_date": _GIVEN_START,
            "end_date": _GIVEN_END,
            "granularity": "month",
            **overrides,
        }
    )


class TestAnalyticsFiltersValidation:
    def test_should_accept_a_range_with_only_the_required_filters(self):
        # GIVEN only the three required filters

        # WHEN the contract parses them
        actual = _given_filters()

        # THEN the range is kept as given
        assert actual.start_date == _GIVEN_START
        assert actual.end_date == _GIVEN_END
        assert actual.granularity == "month"
        # AND every optional filter is absent rather than defaulted to a value
        assert actual.audience_segment is None
        assert actual.login_method is None
        assert actual.institution_id is None

    def test_should_accept_a_single_day_range(self):
        # GIVEN a range whose start and end are the same day
        # WHEN the contract parses it
        actual = _given_filters(start_date=_GIVEN_START, end_date=_GIVEN_START, granularity="day")

        # THEN it is accepted — the range is inclusive at both ends
        assert actual.start_date == actual.end_date

    def test_should_reject_a_start_date_after_the_end_date(self):
        # GIVEN a start date that falls after the end date

        # WHEN the contract parses it
        with pytest.raises(ValidationError) as actual_error:
            _given_filters(start_date=_GIVEN_END, end_date=_GIVEN_START)

        # THEN it is rejected with a message naming both bounds
        assert "start_date must be on or before end_date" in str(actual_error.value)

    @pytest.mark.parametrize("given_granularity", _GRANULARITIES)
    def test_should_accept_every_supported_granularity(self, given_granularity):
        # GIVEN a supported granularity
        # WHEN the contract parses it
        actual = _given_filters(granularity=given_granularity)

        # THEN it is kept
        assert actual.granularity == given_granularity

    @pytest.mark.parametrize("given_granularity", ["quarter", "year", "hour", "", "Month"])
    def test_should_reject_an_unsupported_granularity(self, given_granularity):
        # GIVEN an unsupported granularity
        # WHEN the contract parses it
        with pytest.raises(ValidationError):
            _given_filters(granularity=given_granularity)

    @pytest.mark.parametrize("given_segment", _AUDIENCE_SEGMENTS)
    def test_should_accept_every_supported_audience_segment(self, given_segment):
        # GIVEN a supported audience segment
        # WHEN the contract parses it
        actual = _given_filters(audience_segment=given_segment)

        # THEN it is kept
        assert actual.audience_segment == given_segment

    def test_should_reject_an_unsupported_audience_segment(self):
        # GIVEN a segment outside the shared vocabulary
        # WHEN the contract parses it
        with pytest.raises(ValidationError):
            _given_filters(audience_segment="students")

    @pytest.mark.parametrize("given_method", _LOGIN_METHODS)
    def test_should_accept_every_supported_login_method(self, given_method):
        # GIVEN a supported login method
        # WHEN the contract parses it
        actual = _given_filters(login_method=given_method)

        # THEN it is kept
        assert actual.login_method == given_method

    def test_should_reject_an_unsupported_login_method(self):
        # GIVEN a login method outside the shared vocabulary
        # WHEN the contract parses it
        with pytest.raises(ValidationError):
            _given_filters(login_method="facebook")

    def test_should_reject_an_unknown_filter(self):
        # GIVEN a filter name the contract does not declare (a typo, or a filter that was
        # never implemented)

        # WHEN the contract parses it
        with pytest.raises(ValidationError):
            _given_filters(audience_segement="youth")

    def test_should_not_allow_a_parsed_filter_set_to_be_rewritten(self):
        # GIVEN a parsed filter set
        given = _given_filters()

        # WHEN something downstream tries to widen it
        with pytest.raises(ValidationError):
            given.institution_id = "inst-other"


class TestUpstreamParams:
    def test_should_forward_the_required_filters_unchanged(self):
        # GIVEN a filter set with only the required filters
        given = _given_filters()

        # WHEN it is rendered for upstream
        actual = given.to_upstream_params()

        # THEN the dates travel as ISO strings and the granularity travels verbatim
        assert actual == {"start_date": "2026-01-01", "end_date": "2026-06-30", "granularity": "month"}

    def test_should_forward_the_optional_filters_that_were_given(self):
        # GIVEN a filter set that also narrows by segment and login method
        given = _given_filters(audience_segment=_AUDIENCE_SEGMENTS[0], login_method="google")

        # WHEN it is rendered for upstream
        actual = given.to_upstream_params()

        # THEN both narrowings travel verbatim
        assert actual["audience_segment"] == _AUDIENCE_SEGMENTS[0]
        assert actual["login_method"] == "google"

    def test_should_send_no_value_at_all_for_an_omitted_optional_filter(self):
        # GIVEN a filter set with the optional filters omitted
        given = _given_filters()

        # WHEN it is rendered for upstream
        actual = given.to_upstream_params()

        # THEN the keys are absent rather than present-and-empty, which upstream would
        # otherwise read as a filter matching nothing
        assert "audience_segment" not in actual
        assert "login_method" not in actual

    def test_should_send_the_resolved_scope_rather_than_the_requested_institution(self):
        # GIVEN a caller who asked for one institution
        given = _given_filters(institution_id="inst-asked-for")

        # WHEN it is rendered with the scope the service actually resolved
        actual = given.to_upstream_params(["inst-a", "inst-b"])

        # THEN upstream is told the resolved scope
        assert actual["institution_ids"] == "inst-a,inst-b"
        # AND never the raw ask, which has not been checked against the caller's grant
        assert "institution_id" not in actual

    @pytest.mark.parametrize("given_scope", [None, []])
    def test_should_send_no_scope_when_the_caller_may_see_everything(self, given_scope):
        # GIVEN a caller whose scope resolves to every institution
        given = _given_filters()

        # WHEN it is rendered for upstream
        actual = given.to_upstream_params(given_scope)

        # THEN no institution filter travels, which upstream reads as unrestricted
        assert "institution_ids" not in actual


class TestExtendingTheContract:
    """A slice adds its own filters by subclassing; validation and forwarding come along."""

    def test_should_forward_a_subclass_filter_without_the_subclass_saying_how(self):
        # GIVEN a slice that extends the shared contract with its own filter
        class GivenExtendedFilters(AnalyticsFilters):
            module_id: str | None = None

        given = GivenExtendedFilters(
            start_date=_GIVEN_START, end_date=_GIVEN_END, granularity="week", module_id="job-readiness"
        )

        # WHEN it is rendered for upstream
        actual = given.to_upstream_params()

        # THEN the shared filters and the slice's own filter both travel
        assert actual["granularity"] == "week"
        assert actual["module_id"] == "job-readiness"

    def test_should_apply_the_shared_date_validation_to_a_subclass(self):
        # GIVEN a slice that extends the shared contract
        class GivenExtendedFilters(AnalyticsFilters):
            module_id: str | None = None

        # WHEN it is given an inverted range
        with pytest.raises(ValidationError) as actual_error:
            GivenExtendedFilters(start_date=_GIVEN_END, end_date=_GIVEN_START, granularity="week")

        # THEN the shared rule rejects it, without the subclass restating it
        assert "start_date must be on or before end_date" in str(actual_error.value)

    def test_should_let_a_subclass_keep_one_of_its_filters_off_the_wire(self):
        # GIVEN a slice with a filter it resolves itself rather than forwarding
        class GivenExtendedFilters(AnalyticsFilters):
            UPSTREAM_EXCLUDED_FIELDS = AnalyticsFilters.UPSTREAM_EXCLUDED_FIELDS | {"cohort_id"}

            cohort_id: str | None = None

        given = GivenExtendedFilters(
            start_date=_GIVEN_START, end_date=_GIVEN_END, granularity="day", cohort_id="c-1"
        )

        # WHEN it is rendered for upstream
        actual = given.to_upstream_params()

        # THEN the excluded filter is held back, and the inherited exclusion still holds
        assert "cohort_id" not in actual
        assert "institution_id" not in actual


class TestVerifyBasicFilters:
    """The explicit check an integration point calls before doing anything with a filter set."""

    def test_should_return_the_parsed_filters_for_sound_raw_parameters(self):
        # GIVEN raw query parameters, as they arrive on the wire
        given = {"start_date": "2026-01-01", "end_date": "2026-06-30", "granularity": "month"}

        # WHEN they are verified
        actual = verify_basic_filters(given)

        # THEN a parsed contract comes back, ready to hand to the service
        assert isinstance(actual, AnalyticsFilters)
        assert actual.start_date == _GIVEN_START
        assert actual.granularity == "month"

    def test_should_accept_a_filter_set_that_has_already_been_parsed(self):
        # GIVEN a filter set a dependency already parsed
        given = _given_filters(audience_segment=_AUDIENCE_SEGMENTS[0])

        # WHEN it is verified again — a caller should not have to know which it is holding
        actual = verify_basic_filters(given)

        # THEN it passes and comes back unchanged
        assert actual == given

    def test_should_reject_an_inverted_range_with_a_message_naming_the_rule(self):
        # GIVEN raw parameters whose start date falls after the end date
        given = {"start_date": "2026-06-30", "end_date": "2026-01-01", "granularity": "month"}

        # WHEN they are verified
        with pytest.raises(InvalidFiltersError) as actual_error:
            verify_basic_filters(given)

        # THEN the failure says which rule was broken
        assert "start_date must be on or before end_date" in str(actual_error.value.errors())

    def test_should_reject_an_unsupported_granularity(self):
        # GIVEN raw parameters with a granularity outside the vocabulary
        given = {"start_date": "2026-01-01", "end_date": "2026-06-30", "granularity": "quarter"}

        # WHEN they are verified
        # THEN they are refused
        with pytest.raises(InvalidFiltersError):
            verify_basic_filters(given)

    def test_should_reject_a_missing_required_filter(self):
        # GIVEN raw parameters with no granularity
        given = {"start_date": "2026-01-01", "end_date": "2026-06-30"}

        # WHEN they are verified
        with pytest.raises(InvalidFiltersError) as actual_error:
            verify_basic_filters(given)

        # THEN the missing filter is named
        assert "granularity" in str(actual_error.value.errors())

    def test_should_reject_a_blank_institution_id(self):
        # GIVEN a drill-down sent as blank rather than left out — "?institution_id=" on the wire
        given = {"start_date": "2026-01-01", "end_date": "2026-06-30", "granularity": "day", "institution_id": " "}

        # WHEN they are verified
        with pytest.raises(InvalidFiltersError) as actual_error:
            verify_basic_filters(given)

        # THEN it is refused, pointing at omission as the way to mean "all institutions"
        assert "omit it" in str(actual_error.value.errors())

    def test_should_report_every_field_at_fault_rather_than_only_the_first(self):
        # GIVEN raw parameters with two unsupported values
        given = {
            "start_date": "2026-01-01",
            "end_date": "2026-06-30",
            "granularity": "quarter",
            "login_method": "facebook",
        }

        # WHEN they are verified
        with pytest.raises(InvalidFiltersError) as actual_error:
            verify_basic_filters(given)

        # THEN both are reported together, so a caller fixes them in one go
        actual_fields = {error["loc"][-1] for error in actual_error.value.errors()}
        assert actual_fields == {"granularity", "login_method"}

    def test_should_verify_against_an_extended_contract_when_given_one(self):
        # GIVEN a module that extends the contract with a filter of its own
        class GivenExtendedFilters(AnalyticsFilters):
            module_id: Literal["job-readiness", "jobs"] | None = None

        given = {
            "start_date": "2026-01-01",
            "end_date": "2026-06-30",
            "granularity": "day",
            "module_id": "job-readiness",
        }

        # WHEN they are verified against that contract
        actual = verify_basic_filters(given, GivenExtendedFilters)

        # THEN the module's own filter is parsed alongside the shared ones
        assert isinstance(actual, GivenExtendedFilters)
        assert actual.module_id == "job-readiness"

    def test_should_reject_a_bad_value_for_an_extended_contracts_own_filter(self):
        # GIVEN a module that extends the contract
        class GivenExtendedFilters(AnalyticsFilters):
            module_id: Literal["job-readiness", "jobs"] | None = None

        given = {
            "start_date": "2026-01-01",
            "end_date": "2026-06-30",
            "granularity": "day",
            "module_id": "astrology",
        }

        # WHEN they are verified against that contract
        # THEN the module's own rule is enforced by the same call
        with pytest.raises(InvalidFiltersError):
            verify_basic_filters(given, GivenExtendedFilters)

    async def test_should_become_a_422_when_it_escapes_a_route(self):
        # GIVEN a route that verifies its filters and lets the failure escape
        app = FastAPI()

        @app.get("/verified")
        async def _verified(start_date: str, end_date: str, granularity: str) -> dict:
            verify_basic_filters({"start_date": start_date, "end_date": end_date, "granularity": granularity})
            return {"ok": True}

        # WHEN it is called with an inverted range
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            actual_response = await client.get(
                "/verified", params={"start_date": "2026-06-30", "end_date": "2026-01-01", "granularity": "month"}
            )

        # THEN FastAPI renders it as a 422 without the route catching anything
        assert actual_response.status_code == 422
        assert "start_date must be on or before end_date" in actual_response.text
