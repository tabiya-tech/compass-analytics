import logging
from abc import ABC, abstractmethod

from pydantic import BaseModel

from app.auth.firebase import UserInfo
from app.users.repository import IUserRepository
from app.users.types import MeResponse, UserScope, ScopeType

logger = logging.getLogger(__name__)


class UserNotProvisionedError(Exception):
    """The caller is authenticated but has no record in the `users` collection."""


class ForbiddenInstitutionError(Exception):
    """The caller asked for an institution outside their allowed scope."""


class ScopeResolution(BaseModel):
    """
    The outcome of resolving a caller's access scope for a data request.

    institution_ids is what the analytics repository forwards to the Compass
    upstream as the `institution_ids` CSV. None means "no restriction" — the
    caller has all-institutions access and did not drill into a single one.
    """

    institution_ids: list[str] | None


class IUserService(ABC):
    @abstractmethod
    async def get_me(self, user_info: UserInfo) -> MeResponse: ...

    @abstractmethod
    async def resolve_scope(self, user_info: UserInfo, requested_institution_id: str | None) -> ScopeResolution: ...


class UserService(IUserService):
    def __init__(self, repository: IUserRepository):
        self._repo = repository

    async def _require_record(self, user_info: UserInfo):  # type: ignore[return]
        record = await self._repo.get_by_user_id(user_info.user_id)
        if record is None:
            logger.info("No users record for authenticated user_id=%s (not provisioned).", user_info.user_id)
            raise UserNotProvisionedError(user_info.user_id)
        return record

    async def get_me(self, user_info: UserInfo) -> MeResponse:
        record = await self._require_record(user_info)
        return MeResponse(
            user_id=record.user_id,
            email=user_info.email or record.email,
            name=user_info.name or record.name,
            permissions=[],
            scope=UserScope(type=ScopeType.INSTITUTIONS, institution_ids=[]),
            active_modules=record.active_modules,
        )

    async def resolve_scope(self, user_info: UserInfo, requested_institution_id: str | None) -> ScopeResolution:
        await self._require_record(user_info)
        return ScopeResolution(institution_ids=None if requested_institution_id is None else [requested_institution_id])
