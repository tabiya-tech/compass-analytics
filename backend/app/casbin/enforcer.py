import asyncio
import logging
from typing import Optional

import casbin

from app.casbin.adapter import RolesAdapter
from app.casbin.model import build_model

logger = logging.getLogger(__name__)

_enforcer: Optional[casbin.AsyncEnforcer] = None
_lock = asyncio.Lock()


async def get_enforcer(adapter: Optional[RolesAdapter]) -> casbin.AsyncEnforcer:
    """Process-wide singleton; double-checked locking guards concurrent first-callers.
    Pass adapter=None only when is_enforcer_ready() is True — the singleton is returned directly."""
    global _enforcer
    if _enforcer is not None:
        return _enforcer
    async with _lock:
        if _enforcer is None:
            if adapter is None:
                raise ValueError("adapter required on first initialization")
            enforcer = casbin.AsyncEnforcer(build_model(), adapter)
            await enforcer.load_policy()
            _enforcer = enforcer
    return _enforcer


async def reload_policy() -> None:
    """Reloads all grants from the DB into the in-memory enforcer. No-op if not yet initialized."""
    global _enforcer
    if _enforcer is not None:
        await _enforcer.load_policy()


def is_enforcer_ready() -> bool:
    return _enforcer is not None


def clear_enforcer_cache() -> None:
    """Test-only: resets the singleton so the next get_enforcer() call reinitializes."""
    global _enforcer
    _enforcer = None
