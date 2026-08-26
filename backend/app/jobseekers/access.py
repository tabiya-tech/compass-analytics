import logging
from abc import ABC, abstractmethod

from app.auth.firebase import UserInfo
from app.grants.repository import IGrantRepository
from app.jobseekers.types import AccessScope, JobseekerGrant
from app.users.types import ALL_INSTITUTIONS, Action, Subject

logger = logging.getLogger(__name__)

#: The permission that unlocks the roster. Mirrors PERMISSIONS.JOBSEEKERS_VIEW in the frontend.
JOBSEEKERS_VIEW = f"{Subject.JOBSEEKERS.value}:{Action.VIEW.value}"

#: Nobody, covering nothing. What every caller gets until a grant says otherwise.
DENIED = JobseekerGrant(can_view=False, scope=AccessScope(type="institutions", institution_ids=[]))


class IJobseekerAccessResolver(ABC):
    @abstractmethod
    async def resolve(self, user_info: UserInfo) -> JobseekerGrant: ...


class GrantsAccessResolver(IJobseekerAccessResolver):
    def __init__(self, grant_repository: IGrantRepository):
        self._grants = grant_repository

    async def resolve(self, user_info: UserInfo) -> JobseekerGrant:
        try:
            grants = await self._grants.list_for_user(user_info.user_id)
        except Exception as exc:  # pylint: disable=broad-except
            # An unreadable grant store must not read as permission.
            logger.warning("Could not read grants for user %s: %s", user_info.user_id, exc)
            return DENIED

        viewers = [
            grant
            for grant in grants
            if grant.subject == Subject.JOBSEEKERS and grant.action == Action.VIEW
        ]
        if not viewers:
            return DENIED

        # A single grant on the ALL_INSTITUTIONS sentinel covers the whole deployment, exactly as
        # the Casbin matcher treats p.dom == "*".
        if any(grant.institution_id == ALL_INSTITUTIONS for grant in viewers):
            return JobseekerGrant(can_view=True, scope=AccessScope(type="all"))

        named = sorted({grant.institution_id for grant in viewers if grant.institution_id})
        # A grant naming no institution covers no jobseeker — the permission alone grants nothing.
        if not named:
            return DENIED

        return JobseekerGrant(
            can_view=True,
            scope=AccessScope(type="institutions", institution_ids=named),
        )
