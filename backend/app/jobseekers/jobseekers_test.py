import base64
import json
from urllib.parse import parse_qs

import httpx
import jwt as pyjwt
import pytest
from fastapi import FastAPI

from app.auth.firebase import Authentication
from app.grants.repository import IGrantRepository
from app.grants.types import GrantRecord
from app.jobseekers.access import GrantsAccessResolver
from app.jobseekers.dependencies import get_jobseeker_access_resolver, get_jobseekers_service
from app.jobseekers.institution_ids import encode_institution_id
from app.jobseekers.repositories import CompassStudentsRepository
from app.jobseekers.routes import add_jobseekers_routes
from app.jobseekers.services import JobseekersService
from app.users.types import ALL_INSTITUTIONS, Action, Subject
from common_libs.http_client.base import AsyncHttpClient

_TEST_SECRET = "test-secret-key-long-enough-for-hs256"  # nosec B105 — HS256 signing key for forged test JWTs, not a credential

_INSTITUTION_A_NAME = "Mazabuka Livelihoods Trust"
_INSTITUTION_B_NAME = "Chipata Vocational Centre"
_INSTITUTION_A = encode_institution_id(_INSTITUTION_A_NAME)
_INSTITUTION_B = encode_institution_id(_INSTITUTION_B_NAME)


def _make_token(user_id: str) -> str:
    claims: dict = {
        "sub": user_id,
        "email": f"{user_id}@example.com",
        "name": "Test Operator",
        "firebase": {"sign_in_provider": "password"},
    }
    return pyjwt.encode(claims, key=_TEST_SECRET, algorithm="HS256")


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _grant(user_id: str, subject: Subject, action: Action, institution_id: str) -> GrantRecord:
    return GrantRecord(
        grant_id=f"{user_id}-{subject.value}-{action.value}-{institution_id}",
        user_id=user_id,
        subject=subject,
        action=action,
        institution_id=institution_id,
    )


_USER_A = "user-granted-a"
_USER_B = "user-granted-b"
_USER_ALL = "user-granted-everything"
_USER_BOTH = "user-granted-both-institutions"
_USER_DASHBOARD_ONLY = "user-dashboard-only"
_USER_MANAGE_ONLY = "user-jobseekers-manage-only"
_USER_UNPROVISIONED = "user-with-no-grants"

#: What the `grants` collection holds for each caller in this suite.
_GRANTS: dict[str, list[GrantRecord]] = {
    _USER_A: [_grant(_USER_A, Subject.JOBSEEKERS, Action.VIEW, _INSTITUTION_A)],
    _USER_B: [_grant(_USER_B, Subject.JOBSEEKERS, Action.VIEW, _INSTITUTION_B)],
    _USER_ALL: [_grant(_USER_ALL, Subject.JOBSEEKERS, Action.VIEW, ALL_INSTITUTIONS)],
    _USER_BOTH: [
        _grant(_USER_BOTH, Subject.JOBSEEKERS, Action.VIEW, _INSTITUTION_A),
        _grant(_USER_BOTH, Subject.JOBSEEKERS, Action.VIEW, _INSTITUTION_B),
    ],
    _USER_DASHBOARD_ONLY: [_grant(_USER_DASHBOARD_ONLY, Subject.DASHBOARD, Action.VIEW, _INSTITUTION_A)],
    # Managing jobseekers is not viewing them: the model implies nothing between actions.
    _USER_MANAGE_ONLY: [_grant(_USER_MANAGE_ONLY, Subject.JOBSEEKERS, Action.MANAGE, _INSTITUTION_A)],
    _USER_UNPROVISIONED: [],
}


class _StubGrantRepository(IGrantRepository):
    async def list_all(self) -> list[GrantRecord]:
        return [grant for grants in _GRANTS.values() for grant in grants]

    async def list_for_user(self, user_id: str) -> list[GrantRecord]:
        return list(_GRANTS.get(user_id, []))

    async def list_for_users(self, user_ids: list[str]) -> list[GrantRecord]:
        return [grant for user_id in user_ids for grant in _GRANTS.get(user_id, [])]

    async def create(self, user_id, subject, action, institution_id, granted_by):
        raise NotImplementedError

    async def get_by_tuple(self, user_id, subject, action, institution_id):
        raise NotImplementedError

    async def get_by_grant_id(self, user_id, grant_id):
        raise NotImplementedError

    async def delete(self, user_id, grant_id):
        raise NotImplementedError

    async def set_granted_by(self, user_id, subject, action, institution_id, granted_by):
        raise NotImplementedError

    async def delete_by_tuple(self, user_id, subject, action, institution_id):
        raise NotImplementedError


#: A caller granted the roster for one institution — the common implementer case.
_TOKEN_A = _make_token(_USER_A)
_GRANTED_A = _headers(_TOKEN_A)
#: The same permission, but for the other institution.
_GRANTED_B = _headers(_make_token(_USER_B))
#: Signed in, but never granted the roster.
_UNGRANTED = _headers(_make_token(_USER_DASHBOARD_ONLY))
#: Granted jobseekers:manage, which is not jobseekers:view.
_MANAGE_ONLY = _headers(_make_token(_USER_MANAGE_ONLY))
#: Authenticated, but with no grants at all — the default for any new account.
_NO_GRANTS = _headers(_make_token(_USER_UNPROVISIONED))
#: A deployment-wide grant.
_GRANTED_ALL = _headers(_make_token(_USER_ALL))
#: Two institutions named outright, which Compass has to be asked about one at a time.
_GRANTED_BOTH = _headers(_make_token(_USER_BOTH))


def _student(
    student_id: str,
    name: str,
    institution: str = _INSTITUTION_A_NAME,
    skills_discovery_status: str = "completed",
    modules_explored: int = 3,
    career_readiness_modules_explored: int = 1,
    career_explorer_messages_sent: int = 0,
    last_login: str = "2026-07-04T09:15:00Z",
) -> dict:
    return {
        "id": student_id,
        "name": name,
        "institution": institution,
        "province": "Southern",
        "programme": "Business Studies",
        "qualification_type": "Diploma",
        "year": "2",
        "gender": "Female",
        "active": True,
        "modules_explored": modules_explored,
        "career_readiness_modules_explored": career_readiness_modules_explored,
        "skills_discovery_status": skills_discovery_status,
        "career_explorer_messages_sent": career_explorer_messages_sent,
        "last_login": last_login,
    }


_STUDENTS = [
    _student("u-10230", "María González", skills_discovery_status="completed"),
    _student(
        "u-10231",
        "Kwame Osei",
        skills_discovery_status="in_progress",
        career_readiness_modules_explored=6,
        career_explorer_messages_sent=12,
        last_login="2026-06-25T08:00:00Z",
    ),
    _student(
        "u-10232",
        "Aisha Mwansa",
        skills_discovery_status="not_started",
        modules_explored=0,
        career_readiness_modules_explored=0,
        last_login="2026-05-02T11:30:00Z",
    ),
    _student("u-10240", "Diego Fernández", institution=_INSTITUTION_B_NAME),
]


def _json_response(payload: dict) -> httpx.Response:
    return httpx.Response(200, content=json.dumps(payload).encode(), headers={"content-type": "application/json"})


def _encode_cursor(student_id: str) -> str:
    return base64.urlsafe_b64encode(student_id.encode()).decode().rstrip("=")


def _decode_cursor(cursor: str) -> str:
    return base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)).decode()


class _CompassStub:
    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if request.url.path != "/analytics/jobseekers":
            return httpx.Response(404)

        params = parse_qs(request.url.query.decode())
        institution = params.get("institution", [None])[0]
        limit = int(params.get("limit", ["20"])[0])
        cursor = params.get("cursor", [None])[0]
        wants_count = "count" in (params.get("include", [""])[0] or "").split(",")

        matching = sorted(
            (s for s in _STUDENTS if institution is None or s["institution"] == institution),
            key=lambda s: s["id"],
        )
        remaining = [s for s in matching if cursor is None or s["id"] > _decode_cursor(cursor)]
        page, has_more = remaining[:limit], len(remaining) > limit

        return _json_response(
            {
                "data": page,
                "meta": {
                    "limit": limit,
                    "has_more": has_more,
                    "next_cursor": _encode_cursor(page[-1]["id"]) if page and has_more else None,
                    "total": len(matching) if wants_count else None,
                },
            }
        )

    def paths(self) -> list[str]:
        return [request.url.path for request in self.requests]


def _unavailable_handler(_request: httpx.Request) -> httpx.Response:
    raise httpx.ConnectError("Compass API not available")


def _leaky_handler(request: httpx.Request) -> httpx.Response:
    if request.url.path == "/analytics/jobseekers":
        return _json_response(
            {
                "data": _STUDENTS,
                "meta": {"limit": 100, "has_more": False, "next_cursor": None, "total": len(_STUDENTS)},
            }
        )
    return httpx.Response(404)


def _make_app(handler) -> FastAPI:
    http_client = AsyncHttpClient.__new__(AsyncHttpClient)
    http_client._client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://compass-mock")

    app = FastAPI()
    add_jobseekers_routes(app, Authentication())
    app.dependency_overrides[get_jobseekers_service] = lambda: JobseekersService(
        repository=CompassStudentsRepository(http_client)
    )
    app.dependency_overrides[get_jobseeker_access_resolver] = lambda: GrantsAccessResolver(_StubGrantRepository())
    return app


@pytest.fixture()
def compass() -> _CompassStub:
    return _CompassStub()


@pytest.fixture()
async def client(monkeypatch, compass):
    # GIVEN the server runs in local mode (no Firebase signature verification)
    monkeypatch.setenv("TARGET_ENVIRONMENT_TYPE", "local")
    app = _make_app(compass)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture()
async def client_leaky_api(monkeypatch):
    # GIVEN the server runs in local mode and Compass answers wider than it was asked
    monkeypatch.setenv("TARGET_ENVIRONMENT_TYPE", "local")
    app = _make_app(_leaky_handler)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture()
async def client_no_api(monkeypatch):
    # GIVEN the server runs in local mode and Compass is unreachable
    monkeypatch.setenv("TARGET_ENVIRONMENT_TYPE", "local")
    app = _make_app(_unavailable_handler)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        yield c


def _roster_url(**params) -> str:
    query = "&".join(f"{key}={value}" for key, value in params.items())
    return f"/api/jobseekers?{query}" if query else "/api/jobseekers"


def _names(body: dict) -> list[str]:
    return [item["name"] for item in body["items"]]


class TestJobseekersAuth:
    async def test_should_reject_request_with_no_auth_header(self, client):
        # GIVEN no Authorization header is sent

        # WHEN the roster is requested without a token
        actual_response = await client.get(_roster_url())

        # THEN expect the request to be rejected as unauthenticated
        assert actual_response.status_code == 401

    async def test_should_reject_request_with_an_invalid_token(self, client):
        # GIVEN a bearer token that is not a JWT
        given_headers = {"Authorization": "Bearer not-a-jwt"}

        # WHEN the roster is requested with it
        actual_response = await client.get(_roster_url(), headers=given_headers)

        # THEN expect the request to be rejected as unauthenticated
        assert actual_response.status_code == 401

    async def test_should_call_compass_as_the_operator_who_asked(self, client, compass):
        # GIVEN a caller granted the first institution
        # AND Compass authenticates /students as that user, not as this service

        # WHEN they request the roster
        await client.get(_roster_url(institution_id=_INSTITUTION_A), headers=_GRANTED_A)

        # THEN expect their own bearer token to have been forwarded to Compass
        assert compass.requests
        assert compass.requests[0].headers["Authorization"] == f"Bearer {_TOKEN_A}"


class TestJobseekersAccessControl:
    async def test_should_refuse_a_caller_who_was_never_granted_the_roster(self, client):
        # GIVEN a signed-in caller granted the dashboard but not the jobseekers roster

        # WHEN they request the roster
        actual_response = await client.get(_roster_url(institution_id=_INSTITUTION_A), headers=_UNGRANTED)

        # THEN expect the request to be refused
        assert actual_response.status_code == 403

    async def test_should_refuse_a_caller_with_no_grants_at_all(self, client):
        # GIVEN a caller with no rows in the grants collection — the default for any new account

        # WHEN they request the roster
        actual_response = await client.get(_roster_url(institution_id=_INSTITUTION_A), headers=_NO_GRANTS)

        # THEN expect the request to be refused, because access is denied by default
        assert actual_response.status_code == 403

    async def test_should_refuse_a_caller_granted_manage_rather_than_view(self, client):
        # GIVEN a caller granted jobseekers:manage, and a model where no action implies another

        # WHEN they request the roster
        actual_response = await client.get(_roster_url(institution_id=_INSTITUTION_A), headers=_MANAGE_ONLY)

        # THEN expect the request to be refused rather than read as permission to look
        assert actual_response.status_code == 403

    async def test_should_read_the_grant_from_the_grants_collection_not_the_token(self, client):
        # GIVEN a caller whose token carries no permission claim at all, only their identity
        # AND a jobseekers:view grant recorded against that identity

        # WHEN they request the roster
        actual_response = await client.get(_roster_url(institution_id=_INSTITUTION_A), headers=_GRANTED_A)

        # THEN expect it to be served — the grants collection is the authoritative source
        assert actual_response.status_code == 200
        assert "permissions" not in pyjwt.decode(_TOKEN_A, options={"verify_signature": False})

    async def test_should_refuse_a_request_for_an_institution_outside_the_grant(self, client):
        # GIVEN a caller granted the first institution only

        # WHEN they ask for the second institution's roster
        actual_response = await client.get(_roster_url(institution_id=_INSTITUTION_B), headers=_GRANTED_A)

        # THEN expect the request to be refused rather than quietly answered with an empty roster
        assert actual_response.status_code == 403

    async def test_should_ask_compass_only_about_the_institution_in_the_grant(self, client, compass):
        # GIVEN a caller granted one institution
        # AND Compass filters /analytics/jobseekers by institution name rather than by id

        # WHEN they ask for every institution they are allowed to see
        await client.get(_roster_url(scope="all"), headers=_GRANTED_A)

        # THEN expect the single /analytics/jobseekers call to name that institution, and no other
        actual_institutions = [
            parse_qs(request.url.query.decode()).get("institution", [None])[0] for request in compass.requests
        ]
        assert actual_institutions == [_INSTITUTION_A_NAME]

    async def test_should_query_students_and_nothing_else(self, client, compass):
        # GIVEN /analytics/jobseekers is the only Compass endpoint this service reads

        # WHEN the roster and then a profile are requested
        await client.get(_roster_url(institution_id=_INSTITUTION_A), headers=_GRANTED_A)
        await client.get("/api/jobseekers/u-10230", headers=_GRANTED_A)

        # THEN expect every upstream call to have gone to /analytics/jobseekers
        assert set(compass.paths()) == {"/analytics/jobseekers"}

    async def test_should_not_leak_another_institution_when_the_caller_asks_for_everything(self, client):
        # GIVEN a caller granted the first institution only

        # WHEN they ask for every institution they are allowed to see
        actual_body = (await client.get(_roster_url(scope="all"), headers=_GRANTED_A)).json()

        # THEN expect only their own institution's jobseekers, however wide the question was
        assert _names(actual_body) == ["Aisha Mwansa", "Kwame Osei", "María González"]
        assert "Diego Fernández" not in _names(actual_body)

    async def test_should_drop_a_jobseeker_compass_returns_outside_the_scope(self, client_leaky_api):
        # GIVEN a Compass that ignores the institution filter and answers with the whole deployment

        # WHEN a caller granted the first institution requests the roster
        actual_body = (await client_leaky_api.get(_roster_url(institution_id=_INSTITUTION_A), headers=_GRANTED_A)).json()

        # THEN expect the out-of-scope jobseeker to have been dropped rather than served
        assert "Diego Fernández" not in _names(actual_body)
        assert actual_body["total"] == 3

    async def test_should_serve_every_institution_to_a_deployment_wide_grant(self, client):
        # GIVEN a caller granted every institution in the deployment

        # WHEN they request the roster
        actual_body = (await client.get(_roster_url(scope="all"), headers=_GRANTED_ALL)).json()

        # THEN expect jobseekers from both institutions
        assert "María González" in _names(actual_body)
        assert "Diego Fernández" in _names(actual_body)

    async def test_should_serve_the_second_institution_to_the_grant_that_covers_it(self, client):
        # GIVEN a caller granted the second institution

        # WHEN they request that institution's roster
        actual_body = (await client.get(_roster_url(institution_id=_INSTITUTION_B), headers=_GRANTED_B)).json()

        # THEN expect only that institution's jobseekers
        assert _names(actual_body) == ["Diego Fernández"]


class TestJobseekersPaging:
    async def test_should_read_one_upstream_page_for_the_first_page_of_the_roster(self, client, compass):
        # GIVEN an institution with three jobseekers, asked for one at a time

        # WHEN the first page is requested
        actual_body = (await client.get(_roster_url(institution_id=_INSTITUTION_A, page=1, page_size=1), headers=_GRANTED_A)).json()

        # THEN expect a single upstream read, not the whole roster
        assert len(compass.requests) == 1
        assert len(actual_body["items"]) == 1

    async def test_should_read_only_as_far_as_the_requested_page(self, client, compass):
        # GIVEN a cursor-paged upstream, which cannot be jumped into the middle of

        # WHEN the third page is requested, one jobseeker to a page
        actual_body = (await client.get(_roster_url(institution_id=_INSTITUTION_A, page=3, page_size=1), headers=_GRANTED_A)).json()

        # THEN expect exactly the three reads that reaching the third page needs, and no more
        assert len(compass.requests) == 3
        assert len(actual_body["items"]) == 1
        assert actual_body["page"] == 3

    async def test_should_report_the_rosters_true_size_without_reading_it(self, client):
        # GIVEN an institution with three jobseekers

        # WHEN one page of one is requested
        actual_body = (await client.get(_roster_url(institution_id=_INSTITUTION_A, page=1, page_size=1), headers=_GRANTED_A)).json()

        # THEN expect the count to describe the whole cohort, not the page — Compass counts it
        # alongside the first page, so an honest total costs nothing
        assert actual_body["total"] == 3
        assert len(actual_body["items"]) == 1

    async def test_should_ask_compass_for_the_count_once_and_not_on_every_page(self, client, compass):
        # GIVEN the count is the same answer for every page of a walk

        # WHEN a later page is requested
        await client.get(_roster_url(institution_id=_INSTITUTION_A, page=3, page_size=1), headers=_GRANTED_A)

        # THEN expect only the first read to have asked for it
        actual_include = [parse_qs(request.url.query.decode()).get("include", [None])[0] for request in compass.requests]
        assert actual_include == ["count", None, None]

    async def test_should_follow_the_cursor_compass_gave_for_the_next_page(self, client, compass):
        # GIVEN Compass pages by cursor rather than by offset

        # WHEN the second page is requested
        await client.get(_roster_url(institution_id=_INSTITUTION_A, page=2, page_size=1), headers=_GRANTED_A)

        # THEN expect the second read to carry the cursor the first response returned, so no
        # jobseeker is read twice or skipped
        actual_cursors = [parse_qs(request.url.query.decode()).get("cursor", [None])[0] for request in compass.requests]
        assert actual_cursors[0] is None
        assert actual_cursors[1] == _encode_cursor("u-10230")

    async def test_should_serve_each_page_once_across_the_roster(self, client):
        # GIVEN a roster of three, read one page at a time

        # WHEN every page is requested in turn
        actual_pages = [
            _names((await client.get(_roster_url(institution_id=_INSTITUTION_A, page=page, page_size=1), headers=_GRANTED_A)).json())
            for page in (1, 2, 3)
        ]

        # THEN expect each jobseeker on exactly one page
        assert sorted(name for page in actual_pages for name in page) == ["Aisha Mwansa", "Kwame Osei", "María González"]

    async def test_should_order_the_requested_page_rather_than_the_roster(self, client):
        # GIVEN Compass pages in jobseeker-id order and cannot order by name
        # AND Aisha sorts first by name but last by id, so she belongs to the roster's second page

        # WHEN the first page of two is requested, sorted by name
        actual_body = (await client.get(_roster_url(institution_id=_INSTITUTION_A, page=1, page_size=2), headers=_GRANTED_A)).json()

        # THEN expect that page's own two jobseekers, in name order
        assert _names(actual_body) == ["Kwame Osei", "María González"]
        # AND the alphabetically-first jobseeker of the roster to be absent, because the sort orders
        # the page and not the deployment — the roster-wide ordering Compass cannot give
        assert "Aisha Mwansa" not in _names(actual_body)

    async def test_should_search_within_the_requested_page(self, client, compass):
        # GIVEN Aisha sits on the roster's second page

        # WHEN she is searched for on the first page
        actual_body = (
            await client.get(_roster_url(institution_id=_INSTITUTION_A, page=1, page_size=2, search="aisha"), headers=_GRANTED_A)
        ).json()

        # THEN expect no match and a single upstream read: the search keeps rows on the page it was
        # asked about rather than reading the roster to find more
        assert actual_body["items"] == []
        assert actual_body["total"] == 0
        assert len(compass.requests) == 1

    async def test_should_count_the_matches_when_a_page_is_filtered(self, client):
        # GIVEN one of the first page's two jobseekers has completed Build Your Profile

        # WHEN that page is filtered to the jobseekers who completed it
        actual_body = (
            await client.get(
                _roster_url(institution_id=_INSTITUTION_A, page=1, page_size=2, module_status="build-your-profile:completed"),
                headers=_GRANTED_A,
            )
        ).json()

        # THEN expect the count to describe the rows on screen, not the cohort behind them
        assert _names(actual_body) == ["María González"]
        assert actual_body["total"] == 1

    async def test_should_stop_at_the_page_that_carries_the_jobseeker_asked_for(self, client, compass):
        # GIVEN a profile is read from the same records the roster is

        # WHEN the jobseeker on the roster's first upstream page is opened
        actual_response = await client.get("/api/jobseekers/u-10230", headers=_GRANTED_A)

        # THEN expect reading to have stopped there rather than run to the end of the roster
        assert actual_response.status_code == 200
        assert len(compass.requests) == 1

    async def test_should_count_every_granted_institution_before_reading_any_of_them(self, client, compass):
        # GIVEN a caller granted two institutions, whose roster is two upstream walks
        # AND a first page that may be filled before the second walk is ever started

        # WHEN the first page is requested, one jobseeker to a page
        actual_body = (await client.get(_roster_url(scope="all", page=1, page_size=1), headers=_GRANTED_BOTH)).json()

        # THEN expect the total to cover both institutions, not only the one that was read
        assert actual_body["total"] == 4
        assert len(actual_body["items"]) == 1


class TestJobseekersRoster:
    async def test_should_return_the_roster_sorted_by_name_by_default(self, client):
        # GIVEN a caller granted the first institution

        # WHEN they request the roster without saying how to sort it
        actual_body = (await client.get(_roster_url(institution_id=_INSTITUTION_A), headers=_GRANTED_A)).json()

        # THEN expect the jobseekers in alphabetical order
        assert _names(actual_body) == ["Aisha Mwansa", "Kwame Osei", "María González"]

    async def test_should_identify_each_jobseeker_by_the_institution_their_grant_names(self, client):
        # GIVEN a caller granted the first institution

        # WHEN they request the roster
        actual_items = (await client.get(_roster_url(institution_id=_INSTITUTION_A), headers=_GRANTED_A)).json()["items"]

        # THEN expect each row to carry the institution's id as well as its name, so the frontend
        # can match a row against the same grant it sent
        assert {item["institution_id"] for item in actual_items} == {_INSTITUTION_A}
        assert {item["institution_name"] for item in actual_items} == {_INSTITUTION_A_NAME}

    async def test_should_read_each_modules_status_from_what_compass_reports_about_it(self, client):
        # GIVEN a caller granted the first institution

        # WHEN they request the roster
        actual_items = (await client.get(_roster_url(institution_id=_INSTITUTION_A), headers=_GRANTED_A)).json()["items"]
        by_name = {item["name"]: item["module_status"] for item in actual_items}

        # THEN expect Build Your Profile to follow the skills-discovery flow behind it
        assert by_name["María González"]["build-your-profile"] == "completed"
        assert by_name["Aisha Mwansa"]["build-your-profile"] == "not_started"
        # AND Job Readiness to be finished only once every one of its modules is passed
        assert by_name["Kwame Osei"]["job-readiness"] == "completed"
        assert by_name["María González"]["job-readiness"] == "in_progress"
        assert by_name["Aisha Mwansa"]["job-readiness"] == "not_started"
        # AND Career Explorer to read as started from the messages sent, never as finished
        assert by_name["Kwame Osei"]["career-explorer"] == "in_progress"
        assert by_name["María González"]["career-explorer"] == "not_started"

    async def test_should_report_no_registration_date_rather_than_invent_one(self, client):
        # GIVEN Compass does not report a registration date on /analytics/jobseekers

        # WHEN the roster is requested
        actual_items = (await client.get(_roster_url(institution_id=_INSTITUTION_A), headers=_GRANTED_A)).json()["items"]

        # THEN expect the field to come back empty, for the frontend to show as a dash
        assert all(item["registered_at"] is None for item in actual_items)
        # AND the last login, which Compass does report, to be carried as a date
        assert {item["name"]: item["last_login_at"] for item in actual_items}["María González"] == "2026-07-04"

    async def test_should_sort_by_the_requested_column_and_direction(self, client):
        # GIVEN a caller granted the first institution

        # WHEN they ask for the fullest profiles first
        actual_body = (
            await client.get(
                _roster_url(institution_id=_INSTITUTION_A, sort_by="profile_score_pct", sort_dir="desc"),
                headers=_GRANTED_A,
            )
        ).json()

        # THEN expect the roster ordered by profile score, highest first
        assert _names(actual_body) == ["María González", "Kwame Osei", "Aisha Mwansa"]

    async def test_should_narrow_the_roster_to_the_jobseekers_matching_the_search(self, client):
        # GIVEN a caller granted the first institution

        # WHEN they search for part of a name
        actual_body = (
            await client.get(_roster_url(institution_id=_INSTITUTION_A, search="gonz"), headers=_GRANTED_A)
        ).json()

        # THEN expect only that jobseeker
        assert _names(actual_body) == ["María González"]
        assert actual_body["total"] == 1

    async def test_should_not_pass_the_search_on_to_compass(self, client, compass):
        # GIVEN Compass's own search matches institution, programme and year — not a jobseeker's name

        # WHEN a name is searched for here
        await client.get(_roster_url(institution_id=_INSTITUTION_A, search="gonz"), headers=_GRANTED_A)

        # THEN expect the term not to have been forwarded, where it would answer a different question
        assert all("search" not in request.url.query.decode() for request in compass.requests)

    async def test_should_find_a_jobseeker_by_their_id_as_well_as_their_name(self, client):
        # GIVEN a caller granted the first institution

        # WHEN they search for a jobseeker id
        actual_body = (
            await client.get(_roster_url(institution_id=_INSTITUTION_A, search="u-10231"), headers=_GRANTED_A)
        ).json()

        # THEN expect that jobseeker alone
        assert _names(actual_body) == ["Kwame Osei"]

    async def test_should_keep_only_the_jobseekers_at_the_filtered_stage_of_a_module(self, client):
        # GIVEN a caller granted the first institution

        # WHEN they filter Build Your Profile to the jobseekers who completed it
        actual_body = (
            await client.get(
                _roster_url(institution_id=_INSTITUTION_A, module_status="build-your-profile:completed"),
                headers=_GRANTED_A,
            )
        ).json()

        # THEN expect only those jobseekers
        assert _names(actual_body) == ["María González"]

    async def test_should_page_the_roster_and_still_report_the_full_total(self, client):
        # GIVEN a caller granted the first institution

        # WHEN they ask for the second page of a one-per-page roster
        actual_body = (
            await client.get(_roster_url(institution_id=_INSTITUTION_A, page=2, page_size=1), headers=_GRANTED_A)
        ).json()

        # THEN expect the second jobseeker alone, and the total to describe the whole roster
        assert _names(actual_body) == ["Kwame Osei"]
        assert actual_body["total"] == 3
        assert actual_body["page"] == 2

    async def test_should_mark_the_skills_report_ready_only_once_build_your_profile_is_complete(self, client):
        # GIVEN a caller granted the first institution

        # WHEN they request the roster
        actual_items = (await client.get(_roster_url(institution_id=_INSTITUTION_A), headers=_GRANTED_A)).json()["items"]
        by_name = {item["name"]: item for item in actual_items}

        # THEN expect the completed jobseeker's report to be offered
        assert by_name["María González"]["skills_report_ready"] is True
        # AND the unfinished one's to be withheld rather than half-served
        assert by_name["Kwame Osei"]["skills_report_ready"] is False

    async def test_should_offer_the_report_without_a_skill_count_compass_cannot_give(self, client):
        # GIVEN /analytics/jobseekers reports that Build Your Profile is complete, but not what it elicited

        # WHEN the roster is requested
        actual_items = (await client.get(_roster_url(institution_id=_INSTITUTION_A), headers=_GRANTED_A)).json()["items"]
        by_name = {item["name"]: item for item in actual_items}

        # THEN expect the report to be marked ready, with no invented count behind it
        assert by_name["María González"]["skills_report_ready"] is True
        assert by_name["María González"]["skills"] == []


class TestJobseekerProfile:
    async def test_should_build_the_profile_from_the_students_record(self, client):
        # GIVEN a caller granted the first institution
        # AND Compass has no per-jobseeker endpoint, only /analytics/jobseekers

        # WHEN they open a jobseeker from that institution
        actual_response = await client.get("/api/jobseekers/u-10230", headers=_GRANTED_A)

        # THEN expect the profile to carry what that record reports about them
        assert actual_response.status_code == 200
        actual_body = actual_response.json()
        assert actual_body["name"] == "María González"
        assert actual_body["demographics"]["gender"] == "Female"
        assert actual_body["demographics"]["location"] == "Southern"
        assert actual_body["demographics"]["education"] == "Diploma"

    async def test_should_leave_empty_what_the_students_record_does_not_report(self, client):
        # GIVEN /analytics/jobseekers carries no age, login count, login method or elicited skills

        # WHEN a jobseeker's profile is opened
        actual_body = (await client.get("/api/jobseekers/u-10230", headers=_GRANTED_A)).json()

        # THEN expect those fields to come back empty rather than derived from something adjacent
        assert actual_body["demographics"]["age"] is None
        assert actual_body["login_activity"]["total_logins"] == 0
        assert actual_body["login_activity"]["login_method"] is None
        assert actual_body["skills"] == []

    async def test_should_report_progress_for_every_module_of_the_suite(self, client):
        # GIVEN a caller granted the first institution

        # WHEN they open a jobseeker's profile
        actual_modules = (await client.get("/api/jobseekers/u-10230", headers=_GRANTED_A)).json()["modules"]

        # THEN expect one entry per module, so the frontend can show whichever the deployment runs
        assert [module["module_id"] for module in actual_modules] == [
            "build-your-profile",
            "job-readiness",
            "career-explorer",
            "jobs",
        ]
        # AND no invented step breakdown, since Compass reports none
        assert all(module["sub_modules"] is None for module in actual_modules)

    async def test_should_report_no_skills_report_for_a_jobseeker_who_has_not_finished(self, client):
        # GIVEN a jobseeker who has not completed Build Your Profile

        # WHEN their profile is opened
        actual_body = (await client.get("/api/jobseekers/u-10232", headers=_GRANTED_A)).json()

        # THEN expect the report to be reported as not generated
        assert actual_body["outputs"]["skills_report_generated"] is False
        assert actual_body["skills"] == []

    async def test_should_report_a_jobseeker_outside_the_grant_as_not_found(self, client):
        # GIVEN a caller granted the first institution only

        # WHEN they open a jobseeker who belongs to the second
        actual_response = await client.get("/api/jobseekers/u-10240", headers=_GRANTED_A)

        # THEN expect a not-found, so the response never discloses that the id exists elsewhere
        assert actual_response.status_code == 404

    async def test_should_refuse_a_profile_to_a_caller_who_was_never_granted_the_roster(self, client):
        # GIVEN a signed-in caller with no jobseekers:view permission

        # WHEN they open a jobseeker's profile
        actual_response = await client.get("/api/jobseekers/u-10230", headers=_UNGRANTED)

        # THEN expect the request to be refused
        assert actual_response.status_code == 403

    async def test_should_report_an_unknown_jobseeker_as_not_found(self, client):
        # GIVEN a caller granted the first institution

        # WHEN they open a jobseeker who does not exist
        actual_response = await client.get("/api/jobseekers/u-00000", headers=_GRANTED_A)

        # THEN expect a not-found
        assert actual_response.status_code == 404


class TestJobseekersWhenApiUnavailable:
    async def test_should_return_an_empty_roster_rather_than_an_error(self, client_no_api):
        # GIVEN Compass is unreachable

        # WHEN the roster is requested
        actual_response = await client_no_api.get(_roster_url(institution_id=_INSTITUTION_A), headers=_GRANTED_A)

        # THEN expect a successful, empty response — a missing upstream is not the operator's problem
        assert actual_response.status_code == 200
        assert actual_response.json()["items"] == []
        assert actual_response.json()["total"] == 0

    async def test_should_report_a_profile_as_not_found(self, client_no_api):
        # GIVEN Compass is unreachable

        # WHEN a jobseeker's profile is requested
        actual_response = await client_no_api.get("/api/jobseekers/u-10230", headers=_GRANTED_A)

        # THEN expect a not-found rather than a server error
        assert actual_response.status_code == 404


class TestJobseekersValidation:
    async def test_should_reject_a_malformed_module_status_filter(self, client):
        # GIVEN a module status filter that does not name a status
        given_url = _roster_url(institution_id=_INSTITUTION_A, module_status="build-your-profile")

        # WHEN the roster is requested with it
        actual_response = await client.get(given_url, headers=_GRANTED_A)

        # THEN expect the request to be rejected as a bad request
        assert actual_response.status_code == 400

    async def test_should_reject_a_module_status_filter_naming_an_unknown_module(self, client):
        # GIVEN a filter naming a module that is not part of the suite
        given_url = _roster_url(institution_id=_INSTITUTION_A, module_status="cv-builder:completed")

        # WHEN the roster is requested with it
        actual_response = await client.get(given_url, headers=_GRANTED_A)

        # THEN expect the request to be rejected as a bad request
        assert actual_response.status_code == 400

    async def test_should_reject_an_unsupported_sort_column(self, client):
        # GIVEN a sort key that is not a sortable column
        given_url = _roster_url(institution_id=_INSTITUTION_A, sort_by="gender")

        # WHEN the roster is requested with it
        actual_response = await client.get(given_url, headers=_GRANTED_A)

        # THEN expect a validation error
        assert actual_response.status_code == 422

    async def test_should_reject_a_page_size_beyond_what_the_endpoint_will_serve(self, client):
        # GIVEN a page size larger than the endpoint's limit
        given_url = _roster_url(institution_id=_INSTITUTION_A, page_size=5000)

        # WHEN the roster is requested with it
        actual_response = await client.get(given_url, headers=_GRANTED_A)

        # THEN expect a validation error
        assert actual_response.status_code == 422
