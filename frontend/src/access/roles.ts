import { Action, Subject } from "@/access/ability";
import type { TranslationKey } from "@/i18n/react-i18next";

export const Role = {
  Funder: "funder",
  Implementer: "implementer",
  SuperAdmin: "super_admin",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

// Roles the User Access screen can hand out. super_admin is bootstrapped by an operator.
export const ASSIGNABLE_ROLES: readonly Role[] = [Role.Implementer, Role.Funder];

// The role the grant dialog opens on.
export const DEFAULT_ASSIGNABLE_ROLE: Role = Role.Funder;

// Roles that belong to a single institution rather than the whole deployment. An implementer runs
// Compass at one institution, so their grants are scoped to it; the rest oversee the deployment.
export const INSTITUTION_SCOPED_ROLES: readonly Role[] = [Role.Implementer];

/** Whether granting `role` needs an institution picked for it, rather than covering them all. */
export function isInstitutionScoped(role: Role): boolean {
  return INSTITUTION_SCOPED_ROLES.includes(role);
}

export type Permission = `${Subject}:${Action}`;

function permission(subject: Subject, action: Action): Permission {
  return `${subject}:${action}`;
}

const EVERY_PERMISSION: readonly Permission[] = Object.values(Subject).flatMap((subject) =>
  Object.values(Action).map((action) => permission(subject, action))
);

// What each role grants
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.Implementer]: [
    permission(Subject.Dashboard, Action.View),
    permission(Subject.Jobseekers, Action.View),
    permission(Subject.Account, Action.View),
  ],
  [Role.Funder]: [
    permission(Subject.Dashboard, Action.View),
    permission(Subject.Institutions, Action.View),
    permission(Subject.AccessManagement, Action.Manage),
    permission(Subject.Account, Action.View),
  ],
  [Role.SuperAdmin]: EVERY_PERMISSION,
};

export const ROLE_LABEL_KEYS: Record<Role, TranslationKey> = {
  [Role.Implementer]: "userAccess.roles.implementer.label",
  [Role.Funder]: "userAccess.roles.funder.label",
  [Role.SuperAdmin]: "userAccess.roles.superAdmin.label",
};

export const ROLE_DESCRIPTION_KEYS: Record<Role, TranslationKey> = {
  [Role.Implementer]: "userAccess.roles.implementer.description",
  [Role.Funder]: "userAccess.roles.funder.description",
  [Role.SuperAdmin]: "userAccess.roles.superAdmin.description",
};

const ROLE_PRECEDENCE: readonly Role[] = [Role.SuperAdmin, Role.Funder, Role.Implementer];

// The role the held permissions add up to, or null when they match none.
export function roleFromPermissions(held: readonly string[]): Role | null {
  const holds = new Set(held);
  return ROLE_PRECEDENCE.find((role) => ROLE_PERMISSIONS[role].every((p) => holds.has(p))) ?? null;
}
