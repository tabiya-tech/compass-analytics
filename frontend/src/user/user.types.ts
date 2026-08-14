import type { Action, Subject } from "@/access/ability";

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

/** Sentinel institution_id meaning every institution in the deployment. */
export const ALL_INSTITUTIONS = "*";

export interface GrantView {
  grant_id: string;
  subject: Subject;
  action: Action;
  institution_id: string;
}

/** One row of GET /api/users — a user plus every grant they hold. */
export interface ManagedUser {
  user_id: string;
  email: string | null;
  name: string | null;
  grants: GrantView[];
}

/** Body of POST /api/users/{userId}/grants. */
export interface GrantRequest {
  subject: Subject;
  action: Action;
  institution_id: string;
}
