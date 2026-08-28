"""
Tests for MongoUserRepository (app.users) and MongoGrantRepository (app.grants).

Uses the in-memory Mongo fixture (real Motor + pymongo_inmemory) so the full
Mongo round-trip is exercised without a running server.
"""
import pytest

from app.grants.repository import GRANTS_COLLECTION, MongoGrantRepository
from app.users.repository import USERS_COLLECTION, MongoUserRepository
from app.users.types import Action, Subject, UserRecord


async def _insert_user(db, user_id: str = "u1", **overrides) -> None:
    doc = {"user_id": user_id, "email": f"{user_id}@example.com", "name": "Test User"}
    doc.update(overrides)
    await db[USERS_COLLECTION].insert_one(doc)


async def _insert_grant(db, user_id: str, subject: Subject, action: Action, institution_id: str) -> str:
    import uuid
    grant_id = str(uuid.uuid4())
    await db[GRANTS_COLLECTION].insert_one({
        "grant_id": grant_id,
        "user_id": user_id,
        "subject": subject.value,
        "action": action.value,
        "institution_id": institution_id,
    })
    return grant_id


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


class TestMongoGrantRepository:
    async def test_should_create_and_list_a_grant(self, in_memory_analytics_database):
        # GIVEN an empty grants collection
        repo = MongoGrantRepository(in_memory_analytics_database)

        # WHEN creating a grant
        grant = await repo.create("u1", Subject.DASHBOARD, Action.VIEW, "inst-a", granted_by="admin")

        # THEN it is returned and listable
        assert grant.user_id == "u1"
        assert grant.subject == Subject.DASHBOARD
        assert grant.action == Action.VIEW
        assert grant.institution_id == "inst-a"
        assert grant.granted_by == "admin"

        listed = await repo.list_for_user("u1")
        assert len(listed) == 1
        assert listed[0].grant_id == grant.grant_id

    async def test_should_be_idempotent_on_duplicate_create(self, in_memory_analytics_database):
        # GIVEN a grant already exists
        repo = MongoGrantRepository(in_memory_analytics_database)
        first = await repo.create("u1", Subject.DASHBOARD, Action.VIEW, "inst-a", granted_by="admin")

        # WHEN creating the same grant again
        second = await repo.create("u1", Subject.DASHBOARD, Action.VIEW, "inst-a", granted_by="admin")

        # THEN the existing grant is returned (no duplicate)
        assert first.grant_id == second.grant_id
        all_grants = await repo.list_for_user("u1")
        assert len(all_grants) == 1

    async def test_should_list_grants_for_multiple_users(self, in_memory_analytics_database):
        # GIVEN grants for two users
        repo = MongoGrantRepository(in_memory_analytics_database)
        await repo.create("u1", Subject.DASHBOARD, Action.VIEW, "inst-a", granted_by=None)
        await repo.create("u2", Subject.INSTITUTIONS, Action.VIEW, "*", granted_by=None)

        # WHEN listing for both
        results = await repo.list_for_users(["u1", "u2"])

        # THEN both grants are returned
        assert {g.user_id for g in results} == {"u1", "u2"}

    async def test_should_return_empty_list_when_user_has_no_grants(self, in_memory_analytics_database):
        # GIVEN an empty grants collection
        repo = MongoGrantRepository(in_memory_analytics_database)

        # WHEN listing for a user with no grants
        results = await repo.list_for_user("nobody")

        # THEN an empty list is returned
        assert results == []

    async def test_should_delete_a_grant_and_return_true(self, in_memory_analytics_database):
        # GIVEN an existing grant
        repo = MongoGrantRepository(in_memory_analytics_database)
        grant = await repo.create("u1", Subject.DASHBOARD, Action.VIEW, "inst-a", granted_by=None)

        # WHEN deleting it
        deleted = await repo.delete("u1", grant.grant_id)

        # THEN it is gone
        assert deleted is True
        assert await repo.list_for_user("u1") == []

    async def test_should_return_false_when_deleting_nonexistent_grant(self, in_memory_analytics_database):
        # GIVEN an empty grants collection
        repo = MongoGrantRepository(in_memory_analytics_database)

        # WHEN deleting a grant that doesn't exist
        deleted = await repo.delete("u1", "no-such-grant-id")

        # THEN False is returned
        assert deleted is False

    async def test_should_not_delete_grant_belonging_to_another_user(self, in_memory_analytics_database):
        # GIVEN a grant belonging to u2
        repo = MongoGrantRepository(in_memory_analytics_database)
        grant = await repo.create("u2", Subject.DASHBOARD, Action.VIEW, "inst-a", granted_by=None)

        # WHEN u1 tries to delete it (wrong user_id)
        deleted = await repo.delete("u1", grant.grant_id)

        # THEN nothing is deleted
        assert deleted is False
        assert len(await repo.list_for_user("u2")) == 1
