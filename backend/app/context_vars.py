from contextvars import ContextVar
from typing import Optional

session_id_ctx_var: ContextVar[Optional[str]] = ContextVar("session_id", default=None)
user_id_ctx_var: ContextVar[Optional[str]] = ContextVar("user_id", default=None)
