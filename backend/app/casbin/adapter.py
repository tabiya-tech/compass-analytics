import asyncio

from casbin.async_internal_enforcer import AsyncAdapter
from casbin.persist import load_policy_line

from app.roles.repository import IRoleRepository, IUserRoleRepository


class RolesAdapter(AsyncAdapter):
    """Casbin adapter backed by the roles and user_roles collections."""

    def __init__(self, role_repository: IRoleRepository, user_role_repository: IUserRoleRepository):
        self._roles = role_repository
        self._user_roles = user_role_repository

    async def load_policy(self, model) -> None:
        all_user_roles, all_roles = await asyncio.gather(
            self._user_roles.list_all(),
            self._roles.list_all(),
        )
        roles_by_id = {r.id: r for r in all_roles}
        for user_role in all_user_roles:
            role = roles_by_id.get(user_role.role_id)
            if not role:
                continue
            for perm in role.permissions:
                dom = user_role.institution_id or "*"
                line = f"p, {user_role.user_id}, {dom}, {perm.subject.value}:{perm.action.value}"
                load_policy_line(line, model)

    async def save_policy(self, model) -> None:
        raise NotImplementedError

    async def add_policy(self, sec, ptype, rule) -> None:
        raise NotImplementedError("Policies are managed via the user_roles collection directly.")

    async def remove_policy(self, sec, ptype, rule) -> None:
        raise NotImplementedError("Policies are managed via the user_roles collection directly.")

    async def remove_filtered_policy(self, sec, ptype, field_index, *field_values) -> None:
        raise NotImplementedError
