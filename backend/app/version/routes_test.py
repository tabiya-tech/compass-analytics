from http import HTTPStatus

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.app_config import ApplicationConfig, clear_application_config, set_application_config
from app.version.routes import add_version_routes
from app.version.types import VersionInfo


class TestVersionRoutes:
    def setup_method(self):
        set_application_config(
            ApplicationConfig(
                version_info=VersionInfo(date="2026-01-01", branch="main", buildNumber="42", sha="abc123"),
                environment_type="local",
                environment_name="local",
                frontend_url="http://localhost:5173",
                backend_url="http://localhost:8080",
                enable_sentry=False,
                analytics_mongodb_uri="mongodb://localhost:27017",
                analytics_database_name="test",
            )
        )

    def teardown_method(self):
        clear_application_config()

    def test_should_respond_with_status_ok_and_the_configured_version_info_on_get(self):
        # GIVEN a FastAPI app with the version routes registered
        given_app = FastAPI()
        add_version_routes(given_app)
        given_client = TestClient(given_app)

        # WHEN a GET request is made to /version
        actual_response = given_client.get("/version")

        # THEN expect a response with the status OK
        assert actual_response.status_code == HTTPStatus.OK
        # AND the response body to match the configured version info
        assert actual_response.json() == {
            "date": "2026-01-01",
            "branch": "main",
            "buildNumber": "42",
            "sha": "abc123",
        }
