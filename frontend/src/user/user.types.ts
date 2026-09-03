export type ModuleId = "build-your-profile" | "job-readiness" | "career-explorer" | "jobs";

export interface UserScope {
  // null = deployment-wide (no filter); [] = no access; ["inst-a", ...] = scoped to those institutions.
  institution_ids: string[] | null;
}

export interface PermissionEntry {
  subject: string;
  action: string;
}

export interface RoleRecord {
  _id: string;
  name: string;
  label: string;
  description: string;
  permissions: PermissionEntry[];
  assignable: boolean;
}

export interface UserRoleView {
  role_id: string;
  role_name: string;
  institution_id: string | null;
  granted_by: string | null;
  granted_at: string | null;
}

/** Shape of GET /api/me — the caller's granted permissions and access scope. */
export interface MeResponse {
  user_id: string;
  email: string | null;
  name: string | null;
  organization: string | null;
  role: string | null;
  permissions: string[];
  scope: UserScope;
  active_modules: ModuleId[];
}

/** One row of GET /api/users — a user plus every role they hold. */
export interface ManagedUser {
  user_id: string;
  email: string | null;
  name: string | null;
  roles: UserRoleView[];
}

/** Body of POST /api/users/{userId}/roles. */
export interface AssignRoleRequest {
  role_id: string;
  institution_id: string | null;
}
