export type UserRole = "implementer" | "funder";
export type ScopeType = "all" | "institutions";
export type ModuleId = "build-your-profile" | "job-readiness" | "career-explorer" | "jobs";

export interface UserScope {
  type: ScopeType;
  institution_ids: string[];
}

/** Shape of GET /api/me — the caller's role and access scope, sourced from the backend `users` collection. */
export interface MeResponse {
  user_id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  scope: UserScope;
  active_modules: ModuleId[];
}
