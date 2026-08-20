import type { Action, Subject } from "@/access/ability";
import { ROLE_PERMISSIONS, type Role } from "@/access/roles";
import { ALL_INSTITUTIONS, type GrantView } from "@/user/user.types";

/** The grants POST /users/{id}/roles expands `role` into, for tests and stories to build users from. */
export function grantsForRole(role: Role, institutionId: string = ALL_INSTITUTIONS): GrantView[] {
  return ROLE_PERMISSIONS[role].map((permission) => {
    const [subject, action] = permission.split(":") as [Subject, Action];
    return {
      grant_id: `grant-${role}-${subject}-${action}`,
      subject,
      action,
      institution_id: institutionId,
    };
  });
}
