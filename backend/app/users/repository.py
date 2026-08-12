import logging
from abc import ABC, abstractmethod

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.users.types import UserRecord

logger = logging.getLogger(__name__)

USERS_COLLECTION = "users"


class IUserRepository(ABC):
    @abstractmethod
    async def get_by_user_id(self, user_id: str) -> UserRecord | None: ...

    @abstractmethod
    async def list_all(self) -> list[UserRecord]: ...

    @abstractmethod
    async def upsert(self, record: UserRecord) -> UserRecord: ...


class MongoUserRepository(IUserRepository):
    """
    Reads user identity records from the `users` collection.
    Access control lives in the `grants` collection — see app.grants.repository.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db[USERS_COLLECTION]

    async def get_by_user_id(self, user_id: str) -> UserRecord | None:
        doc = await self._collection.find_one({"user_id": user_id})
        if doc is None:
            return None
        return UserRecord.model_validate(doc)

    async def list_all(self) -> list[UserRecord]:
        return [UserRecord.model_validate(doc) async for doc in self._collection.find({})]

    async def upsert(self, record: UserRecord) -> UserRecord:
        doc = record.model_dump(exclude_none=True)
        await self._collection.update_one({"user_id": record.user_id}, {"$set": doc}, upsert=True)
        return record
