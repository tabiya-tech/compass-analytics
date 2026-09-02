"""
Tests for MongoUserRepository.

Uses the in-memory Mongo fixture (real Motor + pymongo_inmemory) so the full
Mongo round-trip is exercised without a running server.
"""
import pytest

from app.users.repository import USERS_COLLECTION, MongoUserRepository
from app.users.types import UserRecord


async def _insert_user(db, user_id: str = "u1", **overrides) -> None:
    doc = {"user_id": user_id, "email": f"{user_id}@example.com", "name": "Test User"}
    doc.update(overrides)
    await db[USERS_COLLECTION].insert_one(doc)


class TestMongoUserRepository:
    async def test_should_return_user_record_when_found(self, in_memory_analytics_database):
        # GIVEN a user in the collection
        await _insert_user(in_memory_analytics_database, "u1")
        repo = MongoUserRepository(in_memory_analytics_database)

        # WHEN looking up by user_id
        result = await repo.get_by_user_id("u1")

        # THEN the record is returned
        assert result is not None
        assert result.user_id == "u1"
        assert result.email == "u1@example.com"

    async def test_should_return_none_when_not_found(self, in_memory_analytics_database):
        # GIVEN no matching user
        repo = MongoUserRepository(in_memory_analytics_database)

        # WHEN looking up a non-existent user_id
        result = await repo.get_by_user_id("nobody")

        # THEN None is returned
        assert result is None

    async def test_should_list_all_users(self, in_memory_analytics_database):
        # GIVEN two users in the collection
        await _insert_user(in_memory_analytics_database, "u1")
        await _insert_user(in_memory_analytics_database, "u2")
        repo = MongoUserRepository(in_memory_analytics_database)

        # WHEN listing all users
        results = await repo.list_all()

        # THEN both are returned
        assert {r.user_id for r in results} == {"u1", "u2"}

    async def test_should_ignore_extra_fields_from_old_records(self, in_memory_analytics_database):
        # GIVEN a record with legacy fields (role from the old model, active_modules moved to deployment config)
        await in_memory_analytics_database[USERS_COLLECTION].insert_one({
            "user_id": "u1",
            "email": "u1@example.com",
            "role": "implementer",  # legacy field — should be ignored
            "active_modules": [],   # legacy field — now a deployment-level config, ignored here
        })
        repo = MongoUserRepository(in_memory_analytics_database)

        # WHEN reading the record
        result = await repo.get_by_user_id("u1")

        # THEN it parses without error (extra="ignore" on UserRecord)
        assert result is not None
        assert result.user_id == "u1"

    async def test_should_leave_an_existing_field_untouched_when_upserting_a_record_without_it(
        self, in_memory_analytics_database
    ):
        # GIVEN a user with an organization on record — set once at registration
        repo = MongoUserRepository(in_memory_analytics_database)
        await repo.upsert(UserRecord(user_id="u1", email="u1@example.com", name="Test User", organization="Acme Corp"))

        # WHEN a later login upserts the same user with no organization to give (UserService.register
        # builds a fresh UserRecord on every login; a plain login has no organization value to send)
        await repo.upsert(UserRecord(user_id="u1", email="u1@example.com", name="Test User"))

        # THEN the organization set at registration is still there — upsert $sets only the fields the
        # incoming record actually has (exclude_none), rather than replacing the whole document
        result = await repo.get_by_user_id("u1")
        assert result is not None
        assert result.organization == "Acme Corp"

    async def test_should_leave_a_name_untouched_when_upserting_a_record_without_one(
        self, in_memory_analytics_database
    ):
        # GIVEN a user whose name was captured once, e.g. at registration or a later name edit
        repo = MongoUserRepository(in_memory_analytics_database)
        await repo.upsert(UserRecord(user_id="u1", email="u1@example.com", name="Kunda Tembo"))

        # WHEN a plain login upserts the same user with no name to give (a password account's JWT
        # carries none, and UserService.register only passes one through when it's explicitly given)
        await repo.upsert(UserRecord(user_id="u1", email="u1@example.com"))

        # THEN the name is still there, for the same exclude_none reason organization survives above
        result = await repo.get_by_user_id("u1")
        assert result is not None
        assert result.name == "Kunda Tembo"
