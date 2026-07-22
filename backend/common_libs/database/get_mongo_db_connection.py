from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase


def get_mongo_db_connection(mongo_db_uri: str, db_name: str) -> AsyncIOMotorDatabase:
    return AsyncIOMotorClient(mongo_db_uri, tlsAllowInvalidCertificates=True).get_database(db_name)
