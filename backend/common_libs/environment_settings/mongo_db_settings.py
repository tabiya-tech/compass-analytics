from pydantic_settings import BaseSettings


class MongoDbSettings(BaseSettings):
    """
    Mongo connection settings, bound from environment variables by field name
    (case-insensitive). Instantiate lazily, not at import time, so importing
    this module doesn't require the env vars to already be set (matters for
    test collection).
    """

    analytics_mongodb_uri: str = ""
    analytics_database_name: str = ""
