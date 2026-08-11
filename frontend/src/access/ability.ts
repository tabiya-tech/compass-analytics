import { createMongoAbility, type MongoAbility } from "@casl/ability";

export const Subject = {
  Dashboard: "dashboard",
  Institutions: "institutions",
  Jobseekers: "jobseekers",
  AccessManagement: "access-management",
  Account: "account",
} as const;
export type Subject = (typeof Subject)[keyof typeof Subject];

export const Action = {
  View: "view",
  Manage: "manage",
} as const;
export type Action = (typeof Action)[keyof typeof Action];

export type AppAbility = MongoAbility<[Action, Subject]>;

/** Builds a CASL ability from the flat "{subject}:{action}" permission strings returned by /api/me. */
export function buildAbility(permissions: string[]): AppAbility {
  const rules = permissions.map((p) => {
    const [subject, action] = p.split(":") as [Subject, Action];
    return { action, subject };
  });
  return createMongoAbility<AppAbility>(rules);
}
