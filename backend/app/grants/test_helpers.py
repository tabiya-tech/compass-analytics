from app.grants.repository import IGrantRepository
from app.grants.types import GrantRecord
from app.users.types import ALL_INSTITUTIONS, Action, Subject


class FakeGrantRepository(IGrantRepository):
    """
    Test double that grants every caller wildcard dashboard:view access.

    Use in route tests where authz should pass silently — the test subject
    is something else. Override list_all / list_for_user for tests that do
    exercise authz logic directly.
    """

    async def list_all(self) -> list[GrantRecord]:
        return [GrantRecord(grant_id="g0", user_id="u1", subject=Subject.DASHBOARD, action=Action.VIEW, institution_id=ALL_INSTITUTIONS)]

    async def list_for_user(self, user_id: str) -> list[GrantRecord]:
        return await self.list_all()

    async def list_for_users(self, user_ids: list[str]) -> list[GrantRecord]:
        return await self.list_all()

    async def create(self, user_id, subject, action, institution_id, granted_by) -> GrantRecord:
        raise NotImplementedError

    async def delete(self, user_id: str, grant_id: str) -> bool:
        raise NotImplementedError
