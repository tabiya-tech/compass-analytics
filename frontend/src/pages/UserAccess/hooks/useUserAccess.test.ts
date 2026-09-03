import { describe, expect, it } from "vitest";
import { stubRoleRecord, userRoleFor } from "@/_test_utilities/role-grants";
import type { ManagedUser, RoleRecord } from "@/user/user.types";
import { toEntry } from "./useUserAccess";

const FUNDER = stubRoleRecord({ _id: "role-funder", name: "funder", label: "Funder" });
const IMPLEMENTER = stubRoleRecord({ _id: "role-implementer", name: "implementer", label: "Implementer" });

const rolesById = new Map<string, RoleRecord>([
  [FUNDER._id, FUNDER],
  [IMPLEMENTER._id, IMPLEMENTER],
]);

function givenUser(roles: ManagedUser["roles"]): ManagedUser {
  return { user_id: "user-7", email: "v@example.com", name: "Vaani Mumba", roles };
}

describe("toEntry", () => {
  it("should resolve the role from the user's first user_role assignment", () => {
    // GIVEN a user assigned the implementer role
    const user = givenUser([userRoleFor(IMPLEMENTER._id, "inst-1")]);

    // WHEN the row is derived
    const actual = toEntry(user, rolesById);

    // THEN the row resolves to the implementer role record and reports access
    expect(actual.role).toEqual(IMPLEMENTER);
    expect(actual.hasAccess).toBe(true);
  });

  it("should resolve the funder role", () => {
    // GIVEN a user assigned the funder role
    const user = givenUser([userRoleFor(FUNDER._id)]);

    // WHEN the row is derived
    const actual = toEntry(user, rolesById);

    // THEN they are reported as a funder
    expect(actual.role).toEqual(FUNDER);
  });

  it("should report no role for a user who holds no assignments", () => {
    // GIVEN a user with no role assignments
    const user = givenUser([]);

    // WHEN the row is derived
    const actual = toEntry(user, rolesById);

    // THEN there is no role to name and the row offers to grant one
    expect(actual.role).toBeNull();
    expect(actual.hasAccess).toBe(false);
  });

  it("should report access without a role when the role_id is unknown", () => {
    // GIVEN a user assigned a role that is no longer in the roles list
    const user = givenUser([userRoleFor("role-deleted")]);

    // WHEN the row is derived
    const actual = toEntry(user, rolesById);

    // THEN no role is named, but they are still shown as having access
    expect(actual.role).toBeNull();
    expect(actual.hasAccess).toBe(true);
  });

  it("should keep the user as the API returned them, so the row can name them", () => {
    // GIVEN a user with an email and a name
    const user = givenUser([]);

    // WHEN the row is derived
    const actual = toEntry(user, rolesById);

    // THEN the whole user is carried through untouched
    expect(actual.user).toEqual(user);
  });
});
