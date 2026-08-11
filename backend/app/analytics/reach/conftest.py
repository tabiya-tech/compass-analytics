import httpx
import pytest
from fastapi import FastAPI

from app.analytics.dependencies import get_reach_service
from app.analytics.reach.repository import CompassReachRepository
from app.analytics.reach.service import ReachService
from app.analytics.routes import add_analytics_routes
from app.auth.firebase import Authentication
from app.casbin.enforcer import clear_enforcer_cache
from app.grants.test_helpers import FakeGrantRepository
from app.users.dependencies import get_grant_repository
from common_libs.http_client.base import AsyncHttpClient


def _make_app(monkeypatch, reach_service: ReachService) -> FastAPI:
    monkeypatch.setenv("TARGET_ENVIRONMENT_TYPE", "local")
    app = FastAPI()
    add_analytics_routes(app, Authentication())
    app.dependency_overrides[get_reach_service] = lambda: reach_service
    app.dependency_overrides[get_grant_repository] = lambda: FakeGrantRepository()
    return app


def _make_reach_service(transport) -> ReachService:
    from app.analytics.reach.service import ReachService
    from app.users.service import IUserService, ScopeResolution
    from app.auth.firebase import UserInfo
    from app.grants.types import GrantRequest, GrantView, ManagedUser, RoleRequest
    from app.users.types import MeResponse

    class _FakeUserService(IUserService):
        async def get_me(self, user_info: UserInfo) -> MeResponse:
            raise NotImplementedError

        async def resolve_scope(self, user_info: UserInfo, requested_institution_id: str | None) -> ScopeResolution:
            return ScopeResolution(institution_ids=[requested_institution_id] if requested_institution_id else None)

        async def list_managed_users(self, user_info: UserInfo) -> list[ManagedUser]:
            raise NotImplementedError

        async def grant(self, user_info: UserInfo, target_user_id: str, request: GrantRequest) -> GrantView:
            raise NotImplementedError

        async def assign_role(self, user_info: UserInfo, target_user_id: str, request: RoleRequest) -> list[GrantView]:
            raise NotImplementedError

        async def revoke(self, user_info: UserInfo, target_user_id: str, grant_id: str) -> None:
            raise NotImplementedError

    return ReachService(
        repository=CompassReachRepository(AsyncHttpClient(base_url="http://compass-mock", transport=transport)),
        user_service=_FakeUserService(),
    )


@pytest.fixture()
async def make_reach_client(monkeypatch):
    """
    Factory fixture: call with an httpx transport to get a test client.

        async def test_something(make_reach_client):
            client = await make_reach_client(_make_mock_transport(...))
    """
    clients = []

    async def _factory(transport) -> httpx.AsyncClient:
        clear_enforcer_cache()
        app = _make_app(monkeypatch, _make_reach_service(transport))
        client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        await client.__aenter__()
        clients.append(client)
        return client

    yield _factory

    for client in clients:
        await client.__aexit__(None, None, None)
    clear_enforcer_cache()
