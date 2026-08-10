import { PERMISSIONS, type AccessState, type ModuleId, type PermissionKey } from "@/access/access.types";
import type { MeResponse, UserRole } from "@/user/user.types";

/**
 * Which permissions each role gets. Derived from the access matrix:
 * - Both roles see the dashboard and their own account.
 * - Funders oversee a portfolio → institutions view; implementers manage their
 *   own jobseekers → jobseekers view. Neither is granted the other's.
 *
 * Access management is not granted by role here — it's a separate admin concern
 * not represented on the /api/me contract yet.
 */
const ROLE_PERMISSIONS: Record<UserRole, readonly PermissionKey[]> = {
  funder: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.INSTITUTIONS_VIEW, PERMISSIONS.ACCOUNT_VIEW],
  implementer: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.JOBSEEKERS_VIEW, PERMISSIONS.ACCOUNT_VIEW],
};

/** Maps the backend /api/me response onto the frontend AccessState the app consumes. */
export function mapMeToAccess(me: MeResponse): AccessState {
  const scope: AccessState["scope"] =
    me.scope.type === "all" ? { type: "all" } : { type: "institutions", institutionIds: me.scope.institution_ids };

  return {
    permissions: new Set<PermissionKey>(ROLE_PERMISSIONS[me.role]),
    scope,
    activeModules: me.active_modules as readonly ModuleId[],
  };
}
