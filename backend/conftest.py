import logging
import platform
import random
import resource
import string
from typing import AsyncGenerator, Optional

import pymongo
import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo_inmemory import Mongod
from pymongo_inmemory.context import Context

from app.app_config import ApplicationConfig, clear_application_config, set_application_config
from app.auth.api_key import ExternalService
from app.server_dependencies.db_dependencies import AnalyticsDBProvider
from app.version.types import VersionInfo

logger = logging.getLogger(__name__)


def _raise_open_file_limit():
    # pymongo_inmemory's mongod (WiredTiger) needs more open file handles than
    # macOS's default (256) allows — raise the soft limit for this process.
    soft, hard = resource.getrlimit(resource.RLIMIT_NOFILE)
    target = min(hard, 4096)
    if soft < target:
        resource.setrlimit(resource.RLIMIT_NOFILE, (target, hard))


def _random_db_name() -> str:
    return "".join(random.choices(string.ascii_lowercase, k=10))  # nosec B311 # not used for anything security-sensitive


@pytest.fixture(scope="session")
def in_memory_mongo_server():
    _raise_open_file_limit()

    # pymongo_inmemory has a bug where, for Ubuntu/Debian, the generic "linux"
    # OS bucket in its bundled download catalog only has ancient MongoDB
    # builds (<= 4.0), so requesting version="7.0" silently falls back to
    # 4.0.x — which is too old for modern PyMongo (needs wire version >= 8,
    # i.e. MongoDB >= 4.2). Passing an explicit os_name routes to that OS's
    # own catalog entry, which does have modern builds.
    # https://github.com/kaizendorks/pymongo_inmemory/issues/115
    os_name: Optional[str] = None
    uname_version = platform.uname().version.lower()
    if "ubuntu" in uname_version:
        os_name = "ubuntu"
    elif "debian" in uname_version:
        os_name = "debian"

    context = Context(version="7.0", os_name=os_name)
    context.storage_engine = "wiredTiger"
    mongod = Mongod(context)
    mongod.start()
    yield mongod
    mongod.stop()


def _drop_database_and_close_client(connection_string: str, client: AsyncIOMotorClient, db_name: str):
    sync_client = pymongo.MongoClient(connection_string)
    sync_client.drop_database(db_name)
    sync_client.close()
    client.close()


@pytest_asyncio.fixture(scope="function")
async def in_memory_analytics_database(in_memory_mongo_server) -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    db_name = _random_db_name()
    client = AsyncIOMotorClient(in_memory_mongo_server.connection_string)
    db = client.get_database(db_name)
    await AnalyticsDBProvider.initialize_mongo_db(db)
    yield db
    _drop_database_and_close_client(in_memory_mongo_server.connection_string, client, db_name)


@pytest.fixture(scope="function")
def setup_application_config():
    config = ApplicationConfig(
        version_info=VersionInfo(),
        environment_type="local",
        environment_name="local",
        frontend_url="http://localhost:5173",
        backend_url="http://localhost:8080",
        enable_sentry=False,
        analytics_mongodb_uri="mongodb://localhost:27017",
        analytics_database_name="test",
        service_api_keys={ExternalService.COMPASS: "test-compass-api-key"},
        compass_base_url="http://localhost:9999",
        active_modules=["build-your-profile", "job-readiness", "career-explorer", "jobs"],
    )
    set_application_config(config)
    yield config
    clear_application_config()
