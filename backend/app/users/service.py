import logging
from abc import ABC, abstractmethod

from pydantic import BaseModel

from app.app_config import get_application_config
from app.auth.firebase import UserInfo
from app.casbin.enforcer import reload_policy
from app.roles.repository import IRoleRepository, IUserRoleRepository
from app.roles.types import AssignRoleRequest, ManagedUser, RoleRecord, UserRoleView
from app.users.errors import ForbiddenInstitutionError, UserNotProvisionedError
from app.users.repository import IUserRepository
from app.users.types import Action, MeResponse, RegisterRequest, Subject, UserRecord, UserScope

logger = logging.getLogger(__name__)


class ScopeResolution(BaseModel):
    """
    The resolved institution filter for an analytics data request.

    institution_ids=None means the caller has deployment-wide access and
    did not drill into a specific institution — no filter is applied upstream.
    """

    institution_ids: list[str] | None


class IUserService(ABC):
    @abstractmethod
    async def register(self, user_info: UserInfo, profile: RegisterRequest) -> None: ...

    @abstractmethod
    async def get_me(self, user_info: UserInfo) -> MeResponse: ...

    @abstractmethod
    async def resolve_scope(self, user_info: UserInfo, requested_institution_id: str | None) -> ScopeResolution: ...

    @abstractmethod
    async def list_managed_users(self, user_info: UserInfo) -> list[ManagedUser]: ...

    @abstractmethod
    async def assign_role(self, user_info: UserInfo, target_user_id: str, request: AssignRoleRequest) -> UserRoleView: ...

    @abstractmethod
    async def revoke_role(self, user_info: UserInfo, target_user_id: str, user_role_id: str) -> None: ...


class UserService(IUserService):
    def __init__(
        self,
        repository: IUserRepository,
        role_repository: IRoleRepository,
        user_role_repository: IUserRoleRepository,
    ):
        self._repo = repository
        self._roles = role_repository
        self._user_roles = user_role_repository

    async def register(self, user_info: UserInfo, profile: RegisterRequest) -> None:
        record = UserRecord(
            user_id=user_info.user_id,
            email=user_info.email,
            name=profile.name or user_info.name,
            organization=profile.organization,
        )
        await self._repo.upsert(record)
        logger.info("register: upserted user_id=%s", user_info.user_id)

    async def _require_record(self, user_info: UserInfo) -> UserRecord:
        record = await self._repo.get_by_user_id(user_info.user_id)
        if record is None:
            logger.info("No users record for authenticated user_id=%s (not provisioned).", user_info.user_id)
            raise UserNotProvisionedError(user_info.user_id)
        return record

    def _permissions(self, roles: list[RoleRecord]) -> list[str]:
        perms: set[str] = set()
        for role in roles:
            for p in role.permissions:
                perms.add(f"{p.subject.value}:{p.action.value}")
        return sorted(perms)

    def _scope(self, user_roles_with_records: list[tuple[RoleRecord, str | None]]) -> UserScope:
        """Derive scope from the user's assigned roles. Each tuple is (role, institution_id)."""
        dashboard_entries = [
            (role, institution_id)
            for role, institution_id in user_roles_with_records
            for p in role.permissions
            if p.subject == Subject.DASHBOARD and p.action == Action.VIEW
        ]
        if any(institution_id is None for _, institution_id in dashboard_entries):
            return UserScope(institution_ids=None)
        institution_ids = sorted({institution_id for _, institution_id in dashboard_entries if institution_id})
        return UserScope(institution_ids=institution_ids)

    async def _roles_by_id(self) -> dict[str, RoleRecord]:
        return {role.id: role for role in await self._roles.list_all()}

    async def _load_user_roles_with_records(self, user_id: str) -> list[tuple[RoleRecord, str | None]]:
        user_roles = await self._user_roles.list_for_user(user_id)
        roles_by_id = await self._roles_by_id()
        return [
            (roles_by_id[ur.role_id], ur.institution_id)
            for ur in user_roles
            if ur.role_id in roles_by_id
        ]

    async def get_me(self, user_info: UserInfo) -> MeResponse:
        record = await self._require_record(user_info)
        role_records_with_inst = await self._load_user_roles_with_records(user_info.user_id)
        role_records = [role for role, _ in role_records_with_inst]
        return MeResponse(
            user_id=record.user_id,
            email=user_info.email or record.email,
            name=user_info.name or record.name,
            organization=record.organization,
            role=role_records[0].name if role_records else None,
            permissions=self._permissions(role_records),
            scope=self._scope(role_records_with_inst),
            active_modules=get_application_config().active_modules,
        )

    async def resolve_scope(self, user_info: UserInfo, requested_institution_id: str | None) -> ScopeResolution:
        await self._require_record(user_info)
        role_records_with_inst = await self._load_user_roles_with_records(user_info.user_id)
        scope = self._scope(role_records_with_inst)

        if scope.institution_ids is None:
            return ScopeResolution(institution_ids=[requested_institution_id] if requested_institution_id else None)

        if requested_institution_id is None:
            return ScopeResolution(institution_ids=scope.institution_ids)

        if requested_institution_id not in scope.institution_ids:
            raise ForbiddenInstitutionError(requested_institution_id)

        return ScopeResolution(institution_ids=[requested_institution_id])

    async def list_managed_users(self, user_info: UserInfo) -> list[ManagedUser]:
        await self._require_record(user_info)
        users = await self._repo.list_all()
        user_ids = [u.user_id for u in users]
        all_user_roles = await self._user_roles.list_for_users(user_ids)
        roles_by_id = await self._roles_by_id()

        user_roles_by_user: dict[str, list[UserRoleView]] = {}
        for ur in all_user_roles:
            role = roles_by_id.get(ur.role_id)
            if not role:
                continue
            view = UserRoleView(
                role_id=ur.role_id,
                role_name=role.name,
                institution_id=ur.institution_id,
                granted_by=ur.granted_by,
                granted_at=ur.granted_at,
            )
            user_roles_by_user.setdefault(ur.user_id, []).append(view)

        return [
            ManagedUser(
                user_id=u.user_id,
                email=u.email,
                name=u.name,
                roles=user_roles_by_user.get(u.user_id, []),
            )
            for u in users
        ]

    async def assign_role(self, user_info: UserInfo, target_user_id: str, request: AssignRoleRequest) -> UserRoleView:
        from app.users.errors import UnknownRoleError
        await self._require_record(user_info)
        role = await self._roles.get_by_id(request.role_id)
        if role is None:
            raise UnknownRoleError(request.role_id)
        ur = await self._user_roles.assign(
            user_id=target_user_id,
            role_id=request.role_id,
            institution_id=request.institution_id,
            granted_by=user_info.user_id,
        )
        await reload_policy()
        return UserRoleView(
            role_id=ur.role_id,
            role_name=role.name,
            institution_id=ur.institution_id,
            granted_by=ur.granted_by,
            granted_at=ur.granted_at,
        )

    async def revoke_role(self, user_info: UserInfo, target_user_id: str, user_role_id: str) -> None:
        from app.users.errors import GrantNotFoundError
        await self._require_record(user_info)
        removed = await self._user_roles.revoke(user_role_id, target_user_id)
        if not removed:
            raise GrantNotFoundError(user_role_id)
        await reload_policy()
