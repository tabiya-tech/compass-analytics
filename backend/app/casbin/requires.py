from collections.abc import Callable, Coroutine
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.firebase import UserInfo
from app.grants.repository import IGrantRepository
from app.casbin.adapter import GrantsAdapter
from app.casbin.enforcer import get_enforcer
from app.users.types import ALL_INSTITUTIONS, Action, Subject

_REQUIRES_ATTR = "_casbin_requires"


class _RequiresFactory:
    """
    Returned by `make_requires`. Callable as a decorator and exposes `_build_dep`
    for `CasbinAPIRouter` to build the real FastAPI dependency at registration time.

    Usage:
        requires = make_requires(get_user_info, get_grant_repository)

        @router.get("/path")
        @requires(Subject.X, Action.Y)
        async def handler(...):
    """

    def __init__(
        self,
        get_user_info: Callable[..., Coroutine[Any, Any, UserInfo]],
        get_grant_repository: Callable[..., Coroutine[Any, Any, IGrantRepository]],
    ) -> None:
        self._get_user_info = get_user_info
        self._get_grant_repository = get_grant_repository

    def __call__(self, subject: Subject, action: Action) -> Callable:
        """Stamp the permission requirement on the decorated function."""
        def decorator(func: Callable) -> Callable:
            reqs: list[tuple[Subject, Action]] = getattr(func, _REQUIRES_ATTR, [])
            reqs.append((subject, action))
            setattr(func, _REQUIRES_ATTR, reqs)
            return func
        return decorator

    def build_dep(self, subject: Subject, action: Action) -> Callable:
        """Build the FastAPI dependency callable for a given subject+action."""
        get_user_info = self._get_user_info
        get_grant_repository = self._get_grant_repository

        async def _check(
            institution_id: str = Query(ALL_INSTITUTIONS),
            user_info: UserInfo = Depends(get_user_info),
            grant_repo: IGrantRepository = Depends(get_grant_repository),
        ) -> None:
            enforcer = await get_enforcer(GrantsAdapter(grant_repo))
            perm = f"{subject.value}:{action.value}"
            if not enforcer.enforce(user_info.user_id, institution_id, perm):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        _check.__name__ = f"requires_{subject.value}_{action.value}"
        return _check


def make_requires(
    get_user_info: Callable[..., Coroutine[Any, Any, UserInfo]],
    get_grant_repository: Callable[..., Coroutine[Any, Any, IGrantRepository]],
) -> "_RequiresFactory":
    """
    Returns a `requires` decorator factory bound to the given auth and repository
    dependencies. The router must be a `CasbinAPIRouter` for the stamps to take effect.

    Example:
        requires = make_requires(get_user_info, get_grant_repository)
        router = CasbinAPIRouter(requires_factory=requires, ...)

        @router.get("/path")
        @requires(Subject.X, Action.Y)
        async def handler(...):
    """
    return _RequiresFactory(get_user_info, get_grant_repository)


class CasbinAPIRouter(APIRouter):
    """
    APIRouter subclass that reads `_casbin_requires` stamps set by `@requires`
    and injects them as real FastAPI dependencies at registration time, so they
    appear in the OpenAPI spec exactly like `dependencies=[Depends(...)]` would.
    """

    def __init__(self, requires_factory: "_RequiresFactory | None" = None, **kwargs: Any):
        super().__init__(**kwargs)
        self._requires_factory = requires_factory

    def add_api_route(self, path: str, endpoint: Callable, *, dependencies: Any = None, **kwargs: Any) -> None:
        reqs: list[tuple[Subject, Action]] = getattr(endpoint, _REQUIRES_ATTR, [])
        extra: list[Any] = []
        if reqs and self._requires_factory is not None:
            extra = [Depends(self._requires_factory.build_dep(s, a)) for s, a in reqs]
        merged = list(dependencies or []) + extra
        super().add_api_route(path, endpoint, dependencies=merged, **kwargs)
