from casbin.async_internal_enforcer import AsyncAdapter
from casbin.persist import load_policy_line

from app.grants.repository import IGrantRepository
from app.users.types import Action, Subject


class GrantsAdapter(AsyncAdapter):
    """
    Casbin adapter backed by the grants collection.

    Each grant row becomes a policy line:
      p, {user_id}, {institution_id}, {subject}:{action}

    add_policy / remove_policy write through to the grants collection so
    Casbin's in-memory state and the DB stay in sync in a single call.
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
        # rule = [user_id, institution_id, "subject:action"]
        user_id, institution_id, perm = rule
        subject_val, action_val = perm.split(":", 1)
        await self._repo.create(
            user_id=user_id,
            subject=Subject(subject_val),
            action=Action(action_val),
            institution_id=institution_id,
            granted_by=None,
        )

    async def remove_policy(self, sec, ptype, rule) -> None:
        # rule = [user_id, institution_id, "subject:action"]
        user_id, institution_id, perm = rule
        subject_val, action_val = perm.split(":", 1)
        await self._repo.delete_by_tuple(
            user_id=user_id,
            subject=Subject(subject_val),
            action=Action(action_val),
            institution_id=institution_id,
        )

    async def remove_filtered_policy(self, sec, ptype, field_index, *field_values) -> None:
        raise NotImplementedError
