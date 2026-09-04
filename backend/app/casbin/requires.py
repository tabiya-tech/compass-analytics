from collections.abc import Callable
from typing import Any, Optional

from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.firebase import UserInfo
from app.roles.repository import IRoleRepository, IUserRoleRepository
from app.casbin.adapter import RolesAdapter
from app.casbin.enforcer import get_enforcer, is_enforcer_ready
from app.users.types import ALL_INSTITUTIONS, Action, Subject

_REQUIRES_ATTR = "_casbin_requires"


class ResolvedScope(BaseModel):
    # null = deployment-wide; ["inst-a", ...] = scoped to those institutions.
    institution_ids: Optional[list[str]] = None


class _RequiresFactory:
    """Callable decorator and dep() source. See make_requires() and CasbinAPIRouter."""

    def __init__(
        self,
        get_user_info: Callable[..., Any],
        get_role_repository: Callable[..., Any],
        get_user_role_repository: Callable[..., Any],
    ) -> None:
        self._get_user_info = get_user_info
        self._get_role_repository = get_role_repository
        self._get_user_role_repository = get_user_role_repository
        self._cache: dict[tuple, Callable] = {}

    def __call__(self, subject: Subject, action: Action, *, resolves_scope: bool = False) -> Callable:
        """Stamp the permission requirement on the decorated function."""
        def decorator(func: Callable) -> Callable:
            reqs: list[tuple[Subject, Action, bool]] = getattr(func, _REQUIRES_ATTR, [])
            reqs.append((subject, action, resolves_scope))
            setattr(func, _REQUIRES_ATTR, reqs)
            return func
        return decorator

    def dep(self, subject: Subject, action: Action, resolves_scope: bool = False) -> Callable:
        """Return the dep callable for this triple. Same object every call — FastAPI deduplicates by identity."""
        key = (subject, action, resolves_scope)
        if key not in self._cache:
            self._cache[key] = self._build(subject, action, resolves_scope)
        return self._cache[key]

    def _build(self, subject: Subject, action: Action, resolves_scope: bool) -> Callable:
        get_user_info = self._get_user_info
        get_role_repository = self._get_role_repository
        get_user_role_repository = self._get_user_role_repository

        async def _check(
            institution_id: Optional[str] = Query(None),
            user_info: UserInfo = Depends(get_user_info),
            role_repo: IRoleRepository = Depends(get_role_repository),
            user_role_repo: IUserRoleRepository = Depends(get_user_role_repository),
        ) -> Optional[ResolvedScope]:
            adapter = None if is_enforcer_ready() else RolesAdapter(role_repo, user_role_repo)
            enforcer = await get_enforcer(adapter)
            perm = f"{subject.value}:{action.value}"

            if institution_id is not None:
                if not enforcer.enforce(user_info.user_id, institution_id, perm):
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
                return ResolvedScope(institution_ids=[institution_id]) if resolves_scope else None

            if resolves_scope:
                if enforcer.enforce(user_info.user_id, ALL_INSTITUTIONS, perm):
                    return ResolvedScope(institution_ids=None)
                user_roles = await user_role_repo.list_for_user(user_info.user_id)
                institution_ids = sorted(
                    ur.institution_id
                    for ur in user_roles
                    if ur.institution_id and enforcer.enforce(user_info.user_id, ur.institution_id, perm)
                )
                if not institution_ids:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
                return ResolvedScope(institution_ids=institution_ids)

            if not enforcer.enforce(user_info.user_id, ALL_INSTITUTIONS, perm):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
            return None

        _check.__name__ = f"requires_{subject.value}_{action.value}"
        return _check


def make_requires(
    get_user_info: Callable[..., Any],
    get_role_repository: Callable[..., Any],
    get_user_role_repository: Callable[..., Any],
) -> "_RequiresFactory":
    return _RequiresFactory(get_user_info, get_role_repository, get_user_role_repository)


class CasbinAPIRouter(APIRouter):
    """
    APIRouter that reads @requires stamps and injects their deps at route registration.
    Uses requires.dep() so @requires and Depends(requires.dep(...)) share the same object — FastAPI runs it once.
    """

    def __init__(self, requires_factory: "_RequiresFactory | None" = None, **kwargs: Any):
        super().__init__(**kwargs)
        self._requires_factory = requires_factory

    def add_api_route(self, path: str, endpoint: Callable, *, dependencies: Any = None, **kwargs: Any) -> None:
        reqs: list[tuple[Subject, Action, bool]] = getattr(endpoint, _REQUIRES_ATTR, [])
        extra: list[Any] = []
        if reqs and self._requires_factory is not None:
            extra = [Depends(self._requires_factory.dep(s, a, scoped)) for s, a, scoped in reqs]
        merged = list(dependencies or []) + extra
        super().add_api_route(path, endpoint, dependencies=merged, **kwargs)
