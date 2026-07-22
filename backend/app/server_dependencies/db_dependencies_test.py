class TestInMemoryDatabaseFixture:
    async def test_should_connect_to_the_in_memory_mongo_and_allow_basic_operations(self, in_memory_analytics_database):
        # GIVEN the in-memory analytics database fixture
        given_db = in_memory_analytics_database
        given_collection = given_db.get_collection("smoke")

        # WHEN a document is inserted
        await given_collection.insert_one({"hello": "world"})
        # AND the document is read back
        actual_document = await given_collection.find_one({"hello": "world"})

        # THEN the document should be found with the expected value
        assert actual_document is not None
        assert actual_document["hello"] == "world"
