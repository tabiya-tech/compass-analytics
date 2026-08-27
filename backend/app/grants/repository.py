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
    async def list_all(self) -> list[GrantRecord]:
        raise NotImplementedError

    @abstractmethod
    async def list_for_user(self, user_id: str) -> list[GrantRecord]:
        raise NotImplementedError

    @abstractmethod
    async def list_for_users(self, user_ids: list[str]) -> list[GrantRecord]:
        raise NotImplementedError

    @abstractmethod
    async def create(
        self,
        user_id: str,
        subject: Subject,
        action: Action,
        institution_id: str,
        granted_by: str | None,
    ) -> GrantRecord:
        raise NotImplementedError

    @abstractmethod
    async def get_by_tuple(self, user_id: str, subject: Subject, action: Action, institution_id: str) -> GrantRecord | None:
        raise NotImplementedError

    @abstractmethod
    async def get_by_grant_id(self, user_id: str, grant_id: str) -> GrantRecord | None:
        raise NotImplementedError

    @abstractmethod
    async def delete(self, user_id: str, grant_id: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def set_granted_by(self, user_id: str, subject: Subject, action: Action, institution_id: str, granted_by: str) -> None:
        raise NotImplementedError

    @abstractmethod
    async def delete_by_tuple(self, user_id: str, subject: Subject, action: Action, institution_id: str) -> bool:
        raise NotImplementedError


class MongoGrantRepository(IGrantRepository):
    """
    Reads and writes grant tuples from the `grants` collection.
    Each grant is a (user_id, subject, action, institution_id) tuple.
    The unique index on that 4-tuple makes create() idempotent.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db[GRANTS_COLLECTION]

    async def list_all(self) -> list[GrantRecord]:
        try:
            return [GrantRecord.model_validate(doc) async for doc in self._collection.find({})]
        except Exception:
            logger.exception("Failed to list all grants")
            raise

    async def list_for_user(self, user_id: str) -> list[GrantRecord]:
        try:
            return [GrantRecord.model_validate(doc) async for doc in self._collection.find({"user_id": user_id})]
        except Exception:
            logger.exception("Failed to list grants for user_id=%s", user_id)
            raise

    async def list_for_users(self, user_ids: list[str]) -> list[GrantRecord]:
        try:
            return [GrantRecord.model_validate(doc) async for doc in self._collection.find({"user_id": {"$in": user_ids}})]
        except Exception:
            logger.exception("Failed to list grants for user_ids=%s", user_ids)
            raise

    async def create(
        self,
        user_id: str,
        subject: Subject,
        action: Action,
        institution_id: str,
        granted_by: str | None,
    ) -> GrantRecord:
        record = GrantRecord(
            grant_id=str(uuid.uuid4()),
            user_id=user_id,
            subject=subject,
            action=action,
            institution_id=institution_id,
            granted_by=granted_by,
            granted_at=datetime.now(tz=timezone.utc),
        )
        try:
            await self._collection.insert_one(record.model_dump(mode="json"))
        except DuplicateKeyError:
            existing = await self._collection.find_one(
                {"user_id": user_id, "subject": subject.value, "action": action.value, "institution_id": institution_id}
            )
            return GrantRecord.model_validate(existing)
        return record

    async def get_by_tuple(self, user_id: str, subject: Subject, action: Action, institution_id: str) -> GrantRecord | None:
        try:
            doc = await self._collection.find_one(
                {"user_id": user_id, "subject": subject.value, "action": action.value, "institution_id": institution_id}
            )
            return GrantRecord.model_validate(doc) if doc else None
        except Exception:
            logger.exception("Failed to get grant by tuple for user_id=%s", user_id)
            raise

    async def get_by_grant_id(self, user_id: str, grant_id: str) -> GrantRecord | None:
        try:
            doc = await self._collection.find_one({"user_id": user_id, "grant_id": grant_id})
            return GrantRecord.model_validate(doc) if doc else None
        except Exception:
            logger.exception("Failed to get grant by grant_id=%s for user_id=%s", grant_id, user_id)
            raise

    async def set_granted_by(self, user_id: str, subject: Subject, action: Action, institution_id: str, granted_by: str) -> None:
        try:
            await self._collection.update_one(
                {"user_id": user_id, "subject": subject.value, "action": action.value, "institution_id": institution_id},
                {"$set": {"granted_by": granted_by}},
            )
        except Exception:
            logger.exception("Failed to set granted_by for user_id=%s", user_id)
            raise

    async def delete(self, user_id: str, grant_id: str) -> bool:
        try:
            result = await self._collection.delete_one({"user_id": user_id, "grant_id": grant_id})
            return result.deleted_count > 0
        except Exception:
            logger.exception("Failed to delete grant_id=%s for user_id=%s", grant_id, user_id)
            raise

    async def delete_by_tuple(self, user_id: str, subject: Subject, action: Action, institution_id: str) -> bool:
        try:
            result = await self._collection.delete_one(
                {"user_id": user_id, "subject": subject.value, "action": action.value, "institution_id": institution_id}
            )
            return result.deleted_count > 0
        except Exception:
            logger.exception("Failed to delete grant by tuple for user_id=%s", user_id)
            raise
