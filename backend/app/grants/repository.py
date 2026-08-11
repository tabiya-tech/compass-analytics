import logging
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.grants.types import GrantRecord
from app.users.types import Action, Subject

logger = logging.getLogger(__name__)

GRANTS_COLLECTION = "grants"


class IGrantRepository(ABC):
    @abstractmethod
    async def list_all(self) -> list[GrantRecord]: ...

    @abstractmethod
    async def list_for_user(self, user_id: str) -> list[GrantRecord]: ...

    @abstractmethod
    async def list_for_users(self, user_ids: list[str]) -> list[GrantRecord]: ...

    @abstractmethod
    async def create(
        self,
        user_id: str,
        subject: Subject,
        action: Action,
        institution_id: str,
        granted_by: str | None,
    ) -> GrantRecord: ...

    @abstractmethod
    async def delete(self, user_id: str, grant_id: str) -> bool: ...


class MongoGrantRepository(IGrantRepository):
    """
    Reads and writes grant tuples from the `grants` collection.
    Each grant is a (user_id, subject, action, institution_id) tuple.
    The unique index on that 4-tuple makes create() idempotent.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db[GRANTS_COLLECTION]

    async def list_all(self) -> list[GrantRecord]:
        return [GrantRecord.model_validate(doc) async for doc in self._collection.find({})]

    async def list_for_user(self, user_id: str) -> list[GrantRecord]:
        return [GrantRecord.model_validate(doc) async for doc in self._collection.find({"user_id": user_id})]

    async def list_for_users(self, user_ids: list[str]) -> list[GrantRecord]:
        return [GrantRecord.model_validate(doc) async for doc in self._collection.find({"user_id": {"$in": user_ids}})]

    async def create(
        self,
        user_id: str,
        subject: Subject,
        action: Action,
        institution_id: str,
        granted_by: str | None,
    ) -> GrantRecord:
        grant_id = str(uuid.uuid4())
        doc = {
            "grant_id": grant_id,
            "user_id": user_id,
            "subject": subject.value,
            "action": action.value,
            "institution_id": institution_id,
            "granted_by": granted_by,
            "granted_at": datetime.now(tz=timezone.utc),
        }
        try:
            await self._collection.insert_one(doc)
        except DuplicateKeyError:
            existing = await self._collection.find_one(
                {"user_id": user_id, "subject": subject.value, "action": action.value, "institution_id": institution_id}
            )
            return GrantRecord.model_validate(existing)
        return GrantRecord.model_validate(doc)

    async def delete(self, user_id: str, grant_id: str) -> bool:
        result = await self._collection.delete_one({"user_id": user_id, "grant_id": grant_id})
        return result.deleted_count > 0
