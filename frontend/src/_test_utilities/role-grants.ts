import type { RoleRecord, UserRoleView } from "@/user/user.types";

export function stubRoleRecord(overrides: Partial<RoleRecord> = {}): RoleRecord {
  return {
    _id: "role-stub",
    name: "funder",
    label: "Funder",
    description: "Deployment-wide access.",
    permissions: [{ subject: "dashboard", action: "view" }],
    assignable: true,
    ...overrides,
  };
}

export function userRoleFor(roleId: string, institutionId: string | null = null): UserRoleView {
  return { role_id: roleId, role_name: roleId, institution_id: institutionId, granted_by: null, granted_at: null };
}
