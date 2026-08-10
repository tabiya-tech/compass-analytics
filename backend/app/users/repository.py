import logging
from abc import ABC, abstractmethod

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.users.types import UserRecord

logger = logging.getLogger(__name__)

USERS_COLLECTION = "users"


class IUserRepository(ABC):
    @abstractmethod
    async def get_by_user_id(self, user_id: str) -> UserRecord | None: ...


class MongoUserRepository(IUserRepository):
    """
    Reads user role/scope records from the analytics MongoDB `users` collection.
    This is the authoritative source for access control — never derived from the
    Compass upstream, which has no notion of implementer/funder.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db[USERS_COLLECTION]

    async def get_by_user_id(self, user_id: str) -> UserRecord | None:
        doc = await self._collection.find_one({"user_id": user_id})
        if doc is None:
            return None
        return UserRecord.model_validate(doc)
