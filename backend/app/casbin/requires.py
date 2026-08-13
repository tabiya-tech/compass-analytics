from collections.abc import Callable, Coroutine
from typing import Any

from fastapi import Depends, HTTPException, Query, status

from app.auth.firebase import UserInfo
from app.grants.repository import IGrantRepository
from app.casbin.adapter import GrantsAdapter
from app.casbin.enforcer import get_enforcer
from app.users.types import ALL_INSTITUTIONS, Action, Subject


def make_requires(
    get_user_info: Callable[..., Coroutine[Any, Any, UserInfo]],
    get_grant_repository: Callable[..., Coroutine[Any, Any, IGrantRepository]],
) -> Callable[[Subject, Action], Callable]:
    """
    Returns a `requires(subject, action)` factory bound to the given auth and
    repository dependencies. Call once per router, then use:

        requires = make_requires(get_user_info, get_grant_repository)

        @router.get("/path", dependencies=[Depends(requires(Subject.X, Action.Y))])

    Every protected endpoint must supply `institution_id` as a query parameter.
    Users with a wildcard grant (institution_id="*") pass for any institution;
    institution-scoped users pass only for their own institution.
    """

    def requires(subject: Subject, action: Action) -> Callable:
        async def _check(
            institution_id: str = Query(ALL_INSTITUTIONS),
            user_info=Depends(get_user_info),
            grant_repo: IGrantRepository = Depends(get_grant_repository),
        ) -> None:
            enforcer = await get_enforcer(GrantsAdapter(grant_repo))
            perm = f"{subject.value}:{action.value}"
            if not enforcer.enforce(user_info.user_id, institution_id, perm):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        return _check

    return requires
