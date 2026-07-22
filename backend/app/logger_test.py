import json
import logging

from app.context_vars import session_id_ctx_var, user_id_ctx_var
from app.logger import JsonLogFormatter, SessionIdLogFilter


class TestJsonLogFormatter:
    def test_should_format_a_log_record_as_a_single_json_line(self):
        # GIVEN a log record with a message
        given_record = logging.LogRecord(
            name="test.logger",
            level=logging.INFO,
            pathname=__file__,
            lineno=1,
            msg="something happened",
            args=None,
            exc_info=None,
        )

        # WHEN the record is formatted
        actual_output = JsonLogFormatter().format(given_record)

        # THEN the output should be valid JSON
        actual_payload = json.loads(actual_output)
        # AND it should contain the log message
        assert actual_payload["message"] == "something happened"
        # AND the logger name
        assert actual_payload["logger_name"] == "test.logger"
        # AND the level name
        assert actual_payload["logger_level"] == "INFO"


class TestSessionIdLogFilter:
    def test_should_inject_session_and_user_id_from_context_vars(self):
        # GIVEN a session id and user id set in context
        given_session_token = session_id_ctx_var.set("session-123")
        given_user_token = user_id_ctx_var.set("user-456")
        try:
            given_record = logging.LogRecord(
                name="test.logger",
                level=logging.INFO,
                pathname=__file__,
                lineno=1,
                msg="hello",
                args=None,
                exc_info=None,
            )

            # WHEN the filter processes the record
            actual_result = SessionIdLogFilter().filter(given_record)

            # THEN the filter should allow the record through
            assert actual_result is True
            # AND the record should carry the session id
            assert getattr(given_record, "session_id") == "session-123"
            # AND the record should carry the user id
            assert getattr(given_record, "user_id") == "user-456"
        finally:
            session_id_ctx_var.reset(given_session_token)
            user_id_ctx_var.reset(given_user_token)
