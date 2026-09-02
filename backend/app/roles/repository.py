import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.roles.types import RoleRecord, UserRoleRecord

logger = logging.getLogger(__name__)

ROLES_COLLECTION = "roles"
USER_ROLES_COLLECTION = "user_roles"


def _serialize_id(doc: dict) -> dict:
    """Convert ObjectId _id to string for Pydantic."""
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


class IRoleRepository(ABC):
    @abstractmethod
    async def list_all(self) -> list[RoleRecord]:
        raise NotImplementedError

    @abstractmethod
    async def get_by_id(self, role_id: str) -> RoleRecord | None:
        raise NotImplementedError

    @abstractmethod
    async def get_by_name(self, name: str) -> RoleRecord | None:
        raise NotImplementedError


class MongoRoleRepository(IRoleRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db[ROLES_COLLECTION]

    async def list_all(self) -> list[RoleRecord]:
        try:
            return [RoleRecord.model_validate(_serialize_id(doc)) async for doc in self._collection.find({})]
        except Exception:
            logger.exception("Failed to list all roles")
            raise

    async def get_by_id(self, role_id: str) -> RoleRecord | None:
        try:
            doc = await self._collection.find_one({"_id": ObjectId(role_id)})
            return RoleRecord.model_validate(_serialize_id(doc)) if doc else None
        except Exception:
            logger.exception("Failed to get role by id=%s", role_id)
            raise

    async def get_by_name(self, name: str) -> RoleRecord | None:
        try:
            doc = await self._collection.find_one({"name": name})
            return RoleRecord.model_validate(_serialize_id(doc)) if doc else None
        except Exception:
            logger.exception("Failed to get role by name=%s", name)
            raise


class IUserRoleRepository(ABC):
    @abstractmethod
    async def list_all(self) -> list[UserRoleRecord]:
        raise NotImplementedError

    @abstractmethod
    async def list_for_user(self, user_id: str) -> list[UserRoleRecord]:
        raise NotImplementedError

    @abstractmethod
    async def list_for_users(self, user_ids: list[str]) -> list[UserRoleRecord]:
        raise NotImplementedError

    @abstractmethod
    async def assign(self, user_id: str, role_id: str, institution_id: str | None, granted_by: str | None) -> UserRoleRecord:
        raise NotImplementedError

    @abstractmethod
    async def revoke(self, user_role_id: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def revoke_all_for_user(self, user_id: str) -> None:
        raise NotImplementedError


class MongoUserRoleRepository(IUserRoleRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db[USER_ROLES_COLLECTION]

    async def list_all(self) -> list[UserRoleRecord]:
        try:
            return [UserRoleRecord.model_validate(_serialize_id(doc)) async for doc in self._collection.find({})]
        except Exception:
            logger.exception("Failed to list all user_roles")
            raise

    async def list_for_user(self, user_id: str) -> list[UserRoleRecord]:
        try:
            return [UserRoleRecord.model_validate(_serialize_id(doc)) async for doc in self._collection.find({"user_id": user_id})]
        except Exception:
            logger.exception("Failed to list user_roles for user_id=%s", user_id)
            raise

    async def list_for_users(self, user_ids: list[str]) -> list[UserRoleRecord]:
        try:
            return [UserRoleRecord.model_validate(_serialize_id(doc)) async for doc in self._collection.find({"user_id": {"$in": user_ids}})]
        except Exception:
            logger.exception("Failed to list user_roles for user_ids=%s", user_ids)
            raise

    async def assign(self, user_id: str, role_id: str, institution_id: str | None, granted_by: str | None) -> UserRoleRecord:
        doc = {
            "user_id": user_id,
            "role_id": role_id,
            "institution_id": institution_id,
            "granted_by": granted_by,
            "granted_at": datetime.now(tz=timezone.utc),
        }
        try:
            result = await self._collection.insert_one(doc)
            doc["_id"] = str(result.inserted_id)
            return UserRoleRecord.model_validate(doc)
        except DuplicateKeyError:
            existing = await self._collection.find_one({"user_id": user_id, "role_id": role_id, "institution_id": institution_id})
            return UserRoleRecord.model_validate(_serialize_id(existing))

    async def revoke(self, user_role_id: str) -> bool:
        try:
            oid = ObjectId(user_role_id)
        except Exception:
            return False
        try:
            result = await self._collection.delete_one({"_id": oid})
            return result.deleted_count > 0
        except Exception:
            logger.exception("Failed to revoke user_role_id=%s", user_role_id)
            raise

    async def revoke_all_for_user(self, user_id: str) -> None:
        try:
            await self._collection.delete_many({"user_id": user_id})
        except Exception:
            logger.exception("Failed to revoke all user_roles for user_id=%s", user_id)
            raise
