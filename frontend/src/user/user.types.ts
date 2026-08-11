export type ScopeType = "all" | "institutions";
export type ModuleId = "build-your-profile" | "job-readiness" | "career-explorer" | "jobs";

export interface UserScope {
  type: ScopeType;
  institution_ids: string[];
}

/** Shape of GET /api/me — the caller's granted permissions and access scope. */
export interface MeResponse {
  user_id: string;
  email: string | null;
  name: string | null;
  permissions: string[];
  scope: UserScope;
  active_modules: ModuleId[];
}
