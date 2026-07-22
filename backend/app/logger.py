import json
import logging
from datetime import datetime, timezone

from app.context_vars import session_id_ctx_var, user_id_ctx_var


class SessionIdLogFilter(logging.Filter):
    """Injects the current request's session_id/user_id (from contextvars) into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.session_id = session_id_ctx_var.get()
        record.user_id = user_id_ctx_var.get()
        return True


class JsonLogFormatter(logging.Formatter):
    """Emits one JSON line per record, shaped for structured-log ingestion (e.g. Google Cloud Logging)."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "message": record.getMessage(),
            "logger_level": record.levelname,
            "logger_message": record.getMessage(),
            "user_id": getattr(record, "user_id", None),
            "logger_name": record.name,
            "session_id": getattr(record, "session_id", None),
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
        }
        return json.dumps(payload)
