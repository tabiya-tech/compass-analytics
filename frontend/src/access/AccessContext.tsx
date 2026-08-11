import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { TranslationKey } from "@/i18n/react-i18next";

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard:view",
  INSTITUTIONS_VIEW: "institutions:view",
  JOBSEEKERS_VIEW: "jobseekers:view",
  ACCESS_MANAGEMENT_MANAGE: "access-management:manage",
  ACCOUNT_VIEW: "account:view",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const MODULE_IDS = {
  BUILD_YOUR_PROFILE: "build-your-profile",
  JOB_READINESS: "job-readiness",
  CAREER_EXPLORER: "career-explorer",
  JOBS: "jobs",
} as const;

export type ModuleId = (typeof MODULE_IDS)[keyof typeof MODULE_IDS];

/** A module's display name. Shared by the nav and any screen that names a module. */
export const MODULE_LABEL_KEYS: Record<ModuleId, TranslationKey> = {
  [MODULE_IDS.BUILD_YOUR_PROFILE]: "nav.modulesSection.buildYourProfile",
  [MODULE_IDS.JOB_READINESS]: "nav.modulesSection.jobReadiness",
  [MODULE_IDS.CAREER_EXPLORER]: "nav.modulesSection.careerExplorer",
  [MODULE_IDS.JOBS]: "nav.modulesSection.jobs",
};

/** Which institutions a grant covers: every institution in the deployment, or a named list. */
export type AccessScope = { type: "all" } | { type: "institutions"; institutionIds: string[] };

/** True when the grant covers two or more institutions — either "all", or a list of several. */
export function coversMultipleInstitutions(scope: AccessScope): boolean {
  return scope.type === "all" || scope.institutionIds.length > 1;
}

export interface AccessState {
  permissions: ReadonlySet<PermissionKey>;
  scope: AccessScope;
  activeModules: readonly ModuleId[];
}

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
