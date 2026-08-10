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

/** Which institutions a grant covers: every institution in the deployment, or a named list. */
export type AccessScope = { type: "all" } | { type: "institutions"; institutionIds: string[] };

export interface AccessState {
  permissions: ReadonlySet<PermissionKey>;
  scope: AccessScope;
  activeModules: readonly ModuleId[];
}

/** True when the grant covers two or more institutions — either "all", or a list of several. */
export function coversMultipleInstitutions(scope: AccessScope): boolean {
  return scope.type === "all" || scope.institutionIds.length > 1;
}
