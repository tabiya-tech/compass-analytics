import logging
from abc import ABC, abstractmethod

from pydantic import BaseModel

from app.auth.firebase import UserInfo
from app.grants.repository import IGrantRepository
from app.grants.roles import ROLES
from app.grants.types import GrantRecord, GrantRequest, GrantView, ManagedUser, RoleRequest
from app.casbin.enforcer import reload_policy
from app.users.repository import IUserRepository
from app.users.types import ALL_INSTITUTIONS, Action, MeResponse, ScopeType, Subject, UserScope

logger = logging.getLogger(__name__)


class UserNotProvisionedError(Exception):
    """The caller is authenticated but has no record in the `users` collection."""


class ForbiddenInstitutionError(Exception):
    """The caller requested an institution outside their granted scope."""


class UnknownRoleError(Exception):
    """The requested role name does not exist in ROLES."""


class ScopeResolution(BaseModel):
    """
    The resolved institution filter for an analytics data request.

    institution_ids=None means the caller has deployment-wide access and
    did not drill into a specific institution — no filter is applied upstream.
    """

    institution_ids: list[str] | None


class IUserService(ABC):
    @abstractmethod
    async def get_me(self, user_info: UserInfo) -> MeResponse: ...

    @abstractmethod
    async def resolve_scope(self, user_info: UserInfo, requested_institution_id: str | None) -> ScopeResolution: ...

    @abstractmethod
    async def list_managed_users(self, user_info: UserInfo) -> list[ManagedUser]: ...

    @abstractmethod
    async def grant(self, user_info: UserInfo, target_user_id: str, request: GrantRequest) -> GrantView: ...

    @abstractmethod
    async def assign_role(self, user_info: UserInfo, target_user_id: str, request: RoleRequest) -> list[GrantView]: ...

    @abstractmethod
    async def revoke(self, user_info: UserInfo, target_user_id: str, grant_id: str) -> None: ...


class UserService(IUserService):
    def __init__(self, repository: IUserRepository, grant_repository: IGrantRepository):
        self._repo = repository
        self._grants = grant_repository

    async def _require_record(self, user_info: UserInfo):  # type: ignore[return]
        record = await self._repo.get_by_user_id(user_info.user_id)
        if record is None:
            logger.info("No users record for authenticated user_id=%s (not provisioned).", user_info.user_id)
            raise UserNotProvisionedError(user_info.user_id)
        return record

    def _permissions(self, grants: list[GrantRecord]) -> list[str]:
        return sorted({f"{g.subject.value}:{g.action.value}" for g in grants})

    def _scope(self, grants: list[GrantRecord]) -> UserScope:
        dashboard_grants = [g for g in grants if g.subject == Subject.DASHBOARD and g.action == Action.VIEW]
        if any(g.institution_id == ALL_INSTITUTIONS for g in dashboard_grants):
            return UserScope(type=ScopeType.ALL, institution_ids=[])
        institution_ids = sorted({g.institution_id for g in dashboard_grants})
        return UserScope(type=ScopeType.INSTITUTIONS, institution_ids=institution_ids)

    async def get_me(self, user_info: UserInfo) -> MeResponse:
        record = await self._require_record(user_info)
        grants = await self._grants.list_for_user(user_info.user_id)
        return MeResponse(
            user_id=record.user_id,
            email=user_info.email or record.email,
            name=user_info.name or record.name,
            permissions=self._permissions(grants),
            scope=self._scope(grants),
            active_modules=record.active_modules,
        )

    async def resolve_scope(self, user_info: UserInfo, requested_institution_id: str | None) -> ScopeResolution:
        await self._require_record(user_info)
        grants = await self._grants.list_for_user(user_info.user_id)
        scope = self._scope(grants)

        if scope.type == ScopeType.ALL:
            # Deployment-wide access — pass the requested institution through or no filter.
            return ScopeResolution(institution_ids=[requested_institution_id] if requested_institution_id else None)

        # Institution-scoped access.
        if requested_institution_id is None:
            return ScopeResolution(institution_ids=scope.institution_ids)

        if requested_institution_id not in scope.institution_ids:
            raise ForbiddenInstitutionError(requested_institution_id)

        return ScopeResolution(institution_ids=[requested_institution_id])

    async def list_managed_users(self, user_info: UserInfo) -> list[ManagedUser]:
        await self._require_record(user_info)
        users = await self._repo.list_all()
        user_ids = [u.user_id for u in users]
        all_grants = await self._grants.list_for_users(user_ids)
        grants_by_user: dict[str, list[GrantRecord]] = {}
        for g in all_grants:
            grants_by_user.setdefault(g.user_id, []).append(g)
        return [
            ManagedUser(
                user_id=u.user_id,
                email=u.email,
                name=u.name,
                grants=[
                    GrantView(grant_id=g.grant_id, subject=g.subject, action=g.action, institution_id=g.institution_id)
                    for g in grants_by_user.get(u.user_id, [])
                ],
            )
            for u in users
        ]

    async def grant(self, user_info: UserInfo, target_user_id: str, request: GrantRequest) -> GrantView:
        await self._require_record(user_info)
        record = await self._grants.create(
            user_id=target_user_id,
            subject=request.subject,
            action=request.action,
            institution_id=request.institution_id,
            granted_by=user_info.user_id,
        )
        await reload_policy()
        return GrantView(
            grant_id=record.grant_id,
            subject=record.subject,
            action=record.action,
            institution_id=record.institution_id,
        )

    async def assign_role(self, user_info: UserInfo, target_user_id: str, request: RoleRequest) -> list[GrantView]:
        await self._require_record(user_info)
        if request.role not in ROLES:
            raise UnknownRoleError(request.role)
        views = []
        for subject, action in ROLES[request.role]:
            record = await self._grants.create(
                user_id=target_user_id,
                subject=subject,
                action=action,
                institution_id=request.institution_id,
                granted_by=user_info.user_id,
            )
            views.append(GrantView(
                grant_id=record.grant_id,
                subject=record.subject,
                action=record.action,
                institution_id=record.institution_id,
            ))
        await reload_policy()
        return views

    async def revoke(self, user_info: UserInfo, target_user_id: str, grant_id: str) -> None:
        await self._require_record(user_info)
        deleted = await self._grants.delete(user_id=target_user_id, grant_id=grant_id)
        if not deleted:
            raise KeyError(grant_id)
        await reload_policy()
