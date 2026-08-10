import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMe } from "@/user/useMe";
import { mapMeToAccess } from "@/access/mapMeToAccess";
import {
  coversMultipleInstitutions,
  MODULE_IDS,
  PERMISSIONS,
  type AccessScope,
  type AccessState,
  type ModuleId,
  type PermissionKey,
} from "@/access/access.types";

// Re-exported so existing imports from "@/access/AccessContext" keep working;
// the definitions live in access.types.ts to avoid a circular import with
// mapMeToAccess (which AccessContext also imports).
export { PERMISSIONS, MODULE_IDS, coversMultipleInstitutions };
export type { PermissionKey, ModuleId, AccessScope, AccessState };

export interface AccessContextValue extends AccessState {
  hasPermission: (permission: PermissionKey) => boolean;
  isMultiInstitution: boolean; // true ⇒ institution drill-down is meaningful
}

const DEFAULT_ACCESS: AccessState = {
  permissions: new Set(Object.values(PERMISSIONS)),
  scope: { type: "institutions", institutionIds: ["inst-1"] },
  activeModules: Object.values(MODULE_IDS),
};

const AccessContext = createContext<AccessContextValue | null>(null);

export function useAccess(): AccessContextValue {
  const context = useContext(AccessContext);
  if (!context) {
    throw new Error("useAccess must be used within an AccessProvider.");
  }
  return context;
}

/** Fields passed in `access` win; the rest fall back to DEFAULT_ACCESS. */
export function AccessProvider({ children, access }: Readonly<{ children: ReactNode; access?: Partial<AccessState> }>) {
  const value = useMemo<AccessContextValue>(() => {
    const state: AccessState = { ...DEFAULT_ACCESS, ...access };
    return {
      ...state,
      hasPermission: (permission) => state.permissions.has(permission),
      isMultiInstitution: coversMultipleInstitutions(state.scope),
    };
  }, [access]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

/**
 * App-facing provider: fetches the caller's role/scope from GET /api/me and
 * hydrates AccessProvider once resolved. Blocks its children on the fetch so no
 * screen renders against a wrong or default scope.
 *
 * Tests and stories keep using AccessProvider directly with an explicit `access`
 * prop, so they don't need the network round-trip.
 */
export function AccessGate({ children }: Readonly<{ children: ReactNode }>) {
  const me = useMe();
  const { t } = useTranslation();

  if (me.status === "loading") {
    return <div role="status">{t("access.loading")}</div>;
  }
  if (me.status === "unprovisioned") {
    return <div role="alert">{t("access.unprovisioned")}</div>;
  }
  if (me.status === "error") {
    return <div role="alert">{t("access.error")}</div>;
  }

  return <AccessProvider access={mapMeToAccess(me.data)}>{children}</AccessProvider>;
}
