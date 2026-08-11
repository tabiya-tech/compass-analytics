from casbin.async_internal_enforcer import AsyncAdapter
from casbin.persist import load_policy_line

from app.grants.repository import IGrantRepository


class GrantsAdapter(AsyncAdapter):
    """
    Read-only Casbin adapter backed by the grants collection.

    Each grant row becomes a policy line:
      p, {user_id}, {institution_id}, {subject}:{action}

    Write methods are intentionally unsupported — grants are managed
    through the grants service, which calls reload_policy() after any change.
    """

    def __init__(self, grant_repository: IGrantRepository):
        self._repo = grant_repository

    async def load_policy(self, model) -> None:
        for grant in await self._repo.list_all():
            line = f"p, {grant.user_id}, {grant.institution_id}, {grant.subject.value}:{grant.action.value}"
            load_policy_line(line, model)

    async def save_policy(self, model) -> None:
        raise NotImplementedError

    async def add_policy(self, sec, ptype, rule) -> None:
        raise NotImplementedError

    async def remove_policy(self, sec, ptype, rule) -> None:
        raise NotImplementedError

    async def remove_filtered_policy(self, sec, ptype, field_index, *field_values) -> None:
        raise NotImplementedError
