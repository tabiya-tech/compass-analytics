import logging
from abc import ABC, abstractmethod

from app.analytics.institutions.repository import IInstitutionsRepository
from app.analytics.institutions.types import (
    CompassInstitutionSummary,
    InstitutionDetail,
    InstitutionItem,
    InstitutionLoginActivity,
    InstitutionModuleProgress,
    InstitutionReach,
    InstitutionsResponse,
    InstitutionsTotals,
)
from app.auth.firebase import UserInfo
from app.users.service import IUserService

logger = logging.getLogger(__name__)

# Module IDs as used by the frontend, mapped from Compass field names.
_MODULE_PCT_MAP = {
    "build-your-profile": "skills_discovery_started_pct",
    "job-readiness": "career_readiness_started_pct",
    "career-explorer": "career_explorer_started_pct",
}


def _to_item(raw: CompassInstitutionSummary) -> InstitutionItem:
    module_started_pct: dict[str, float] = {}
    for module_id, field in _MODULE_PCT_MAP.items():
        value = getattr(raw, field, None)
        if value is not None:
            module_started_pct[module_id] = value

    return InstitutionItem(
        id=raw.institution_id,
        name=raw.institution_name,
        registered_users=raw.registered_users,
        active_users=raw.active_users_7d,
        module_started_pct=module_started_pct,
    )


def _to_detail(raw: CompassInstitutionSummary) -> InstitutionDetail:
    modules: list[InstitutionModuleProgress] = []
    for module_id, field in _MODULE_PCT_MAP.items():
        value = getattr(raw, field, None)
        if value is not None:
            modules.append(InstitutionModuleProgress(module_id=module_id, started_pct=value))

    return InstitutionDetail(
        id=raw.institution_id,
        name=raw.institution_name,
        reach=InstitutionReach(
            registered_users=raw.registered_users,
            active_users_30d=raw.active_users_7d,
        ),
        login_activity=InstitutionLoginActivity(),
        modules=modules,
    )


class IInstitutionsService(ABC):
    @abstractmethod
    async def get_institutions(self, institution_id: str | None, user_info: UserInfo) -> InstitutionsResponse: ...

    @abstractmethod
    async def get_institution(self, institution_id: str, user_info: UserInfo) -> InstitutionDetail | None: ...


class InstitutionsService(IInstitutionsService):
    def __init__(self, repository: IInstitutionsRepository, user_service: IUserService):
        self._repo = repository
        self._users = user_service

    async def get_institutions(self, institution_id: str | None, user_info: UserInfo) -> InstitutionsResponse:
        scope = await self._users.resolve_scope(user_info, institution_id)
        compass_response = await self._repo.get_institutions(scope.institution_ids)

        items = [_to_item(raw) for raw in compass_response.institutions]
        total_registered = sum(i.registered_users for i in items)

        return InstitutionsResponse(
            items=items,
            total=len(items),
            page=1,
            page_size=max(len(items), 1),
            totals=InstitutionsTotals(
                jobseekers_reached=total_registered,
                skills_reports=0,
                institutions=len(items),
            ),
            available_regions=[],
        )

    async def get_institution(self, institution_id: str, user_info: UserInfo) -> InstitutionDetail | None:
        scope = await self._users.resolve_scope(user_info, institution_id)
        compass_response = await self._repo.get_institutions(scope.institution_ids)

        for raw in compass_response.institutions:
            if raw.institution_id == institution_id:
                return _to_detail(raw)
        return None
