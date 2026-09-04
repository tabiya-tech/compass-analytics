import httpx
import pytest
from fastapi import FastAPI

from app.analytics.dependencies import get_modules_service, get_reach_service
from app.analytics.modules.repository import CompassModulesRepository
from app.analytics.modules.service import ModulesService
from app.analytics.reach.repository import CompassReachRepository
from app.analytics.reach.service import ReachService
from app.analytics.routes import add_analytics_routes
from app.auth.firebase import Authentication, UserInfo
from app.casbin.enforcer import clear_enforcer_cache
from app.roles.test_helpers import FakeRoleRepository, FakeUserRoleRepository
from app.roles.types import AssignRoleRequest, ManagedUser, UserRoleView
from app.users.dependencies import get_role_repository, get_user_role_repository
from app.users.service import IUserService, ScopeResolution
from app.users.types import MeResponse
from common_libs.http_client.base import AsyncHttpClient

_EMPTY_REACH_PAYLOAD = {
    "summary": {
        "total_users": 0, "active_users_30d": 0, "total_logins": 0,
        "avg_logins_per_user": 0.0, "avg_session_minutes": 0.0,
    },
    "series": [],
}


class _FakeUserService(IUserService):
    async def register(self, user_info: UserInfo) -> None:
        raise NotImplementedError

    async def get_me(self, user_info: UserInfo) -> MeResponse:
        raise NotImplementedError

    async def resolve_scope(self, user_info: UserInfo, requested_institution_id: str | None) -> ScopeResolution:
        return ScopeResolution(institution_ids=[requested_institution_id] if requested_institution_id else None)

    async def list_managed_users(self, user_info: UserInfo) -> list[ManagedUser]:
        raise NotImplementedError

    async def assign_role(self, user_info: UserInfo, target_user_id: str, request: AssignRoleRequest) -> UserRoleView:
        raise NotImplementedError

    async def revoke_role(self, user_info: UserInfo, target_user_id: str, user_role_id: str) -> None:
        raise NotImplementedError


def _make_reach_service_stub() -> ReachService:
    """Lets /api/reach stay callable on this app too, to check it isn't affected by the new route."""
    transport = httpx.MockTransport(lambda _request: httpx.Response(200, json=_EMPTY_REACH_PAYLOAD))
    return ReachService(
        repository=CompassReachRepository(AsyncHttpClient(base_url="http://compass-mock", transport=transport)),
        user_service=_FakeUserService(),
    )


def _make_modules_service(transport) -> ModulesService:
    return ModulesService(
        repository=CompassModulesRepository(AsyncHttpClient(base_url="http://compass-mock", transport=transport)),
        user_service=_FakeUserService(),
    )


def _make_app(monkeypatch, modules_service: ModulesService) -> FastAPI:
    monkeypatch.setenv("TARGET_ENVIRONMENT_TYPE", "local")
    app = FastAPI()
    add_analytics_routes(app, Authentication())
    app.dependency_overrides[get_modules_service] = lambda: modules_service
    app.dependency_overrides[get_reach_service] = _make_reach_service_stub
    app.dependency_overrides[get_role_repository] = lambda: FakeRoleRepository()
    app.dependency_overrides[get_user_role_repository] = lambda: FakeUserRoleRepository()
    return app


@pytest.fixture()
async def make_modules_client(monkeypatch):
    """
    Factory fixture: call with an httpx transport to get a test client.

        async def test_something(make_modules_client):
            client = await make_modules_client(_make_mock_transport(...))
    """
    clients = []

    async def _factory(transport) -> httpx.AsyncClient:
        clear_enforcer_cache()
        app = _make_app(monkeypatch, _make_modules_service(transport))
        client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        await client.__aenter__()
        clients.append(client)
        return client

    yield _factory

    for client in clients:
        await client.__aexit__(None, None, None)
    clear_enforcer_cache()
