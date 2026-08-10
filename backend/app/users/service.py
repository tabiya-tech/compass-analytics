import logging
from abc import ABC, abstractmethod

from pydantic import BaseModel

from app.auth.firebase import UserInfo
from app.users.repository import IUserRepository
from app.users.types import MeResponse, ScopeType, UserRecord, UserRole, UserScope

logger = logging.getLogger(__name__)


class UserNotProvisionedError(Exception):
    """The caller is authenticated but has no record in the `users` collection."""


class ForbiddenInstitutionError(Exception):
    """The caller asked for an institution outside their allowed scope."""


class ScopeResolution(BaseModel):
    """
    The outcome of resolving a caller's access scope for a data request.

    institution_ids is what the analytics repository forwards to the Compass
    upstream as the `institution_ids` CSV. None means "no restriction" — used
    only for a funder whose scope_type is ALL and who did not drill into a
    single institution.
    """

    role: UserRole
    institution_ids: list[str] | None


class IUserService(ABC):
    @abstractmethod
    async def get_me(self, user_info: UserInfo) -> MeResponse: ...

    @abstractmethod
    async def resolve_scope(self, user_info: UserInfo, requested_institution_id: str | None) -> ScopeResolution: ...


class UserService(IUserService):
    def __init__(self, repository: IUserRepository):
        self._repo = repository

    async def _require_record(self, user_info: UserInfo) -> UserRecord:
        record = await self._repo.get_by_user_id(user_info.user_id)
        if record is None:
            logger.info("No users record for authenticated user_id=%s (not provisioned).", user_info.user_id)
            raise UserNotProvisionedError(user_info.user_id)
        return record

    async def get_me(self, user_info: UserInfo) -> MeResponse:
        record = await self._require_record(user_info)
        return MeResponse(
            user_id=record.user_id,
            # The JWT is fresher than the stored copy for identity fields, so
            # prefer it and fall back to whatever was provisioned on the record.
            email=user_info.email or record.email,
            name=user_info.name or record.name,
            role=record.role,
            scope=UserScope(type=record.scope_type, institution_ids=record.institution_ids),
            active_modules=record.active_modules,
        )

    async def resolve_scope(self, user_info: UserInfo, requested_institution_id: str | None) -> ScopeResolution:
        record = await self._require_record(user_info)

        if record.role == UserRole.IMPLEMENTER:
            return self._resolve_implementer(record, requested_institution_id)

        return self._resolve_funder(record, requested_institution_id)

    @staticmethod
    def _resolve_implementer(record: UserRecord, requested_institution_id: str | None) -> ScopeResolution:
        # An implementer is always pinned to their own institution(s); any
        # drill-down param must name one of those, otherwise it's a foreign id.
        own = record.institution_ids
        if requested_institution_id is not None and requested_institution_id not in own:
            raise ForbiddenInstitutionError(requested_institution_id)
        institution_ids = [requested_institution_id] if requested_institution_id else own
        return ScopeResolution(role=record.role, institution_ids=institution_ids)

    @staticmethod
    def _resolve_funder(record: UserRecord, requested_institution_id: str | None) -> ScopeResolution:
        if requested_institution_id is not None:
            # Drill-down: allowed only if it's within the funder's portfolio.
            # A scope_type of ALL means the whole deployment is in-portfolio.
            if record.scope_type != ScopeType.ALL and requested_institution_id not in record.institution_ids:
                raise ForbiddenInstitutionError(requested_institution_id)
            return ScopeResolution(role=record.role, institution_ids=[requested_institution_id])

        # No drill-down: aggregate across the whole portfolio. ALL scope means
        # no institution filter at all (upstream returns the full deployment).
        if record.scope_type == ScopeType.ALL:
            return ScopeResolution(role=record.role, institution_ids=None)
        return ScopeResolution(role=record.role, institution_ids=record.institution_ids)
