import { describe, expect, it } from "vitest";
import { Action, Subject } from "@/access/ability";
import { Role } from "@/access/roles";
import { grantsForRole } from "@/_test_utilities/role-grants";
import { ALL_INSTITUTIONS, type ManagedUser } from "@/user/user.types";
import { toEntry } from "./useUserAccess";

function givenUser(grants: ManagedUser["grants"]): ManagedUser {
  return { user_id: "user-7", email: "v@example.com", name: "Vaani Mumba", grants };
}

const grant = (grantId: string, subject: Subject, action: Action, institutionId = ALL_INSTITUTIONS) => ({
  grant_id: grantId,
  subject,
  action,
  institution_id: institutionId,
});

describe("toEntry", () => {
  it("should name the role the user's grants add up to", () => {
    // GIVEN a user holding the grants an implementer role expands into
    const user = givenUser(grantsForRole(Role.Implementer));

    // WHEN the row is derived
    const actual = toEntry(user);

    // THEN the row can name their role, and reports them as holding access
    expect(actual.role).toBe(Role.Implementer);
    expect(actual.hasAccess).toBe(true);
  });

  it("should name the funder role from the grants it expands into", () => {
    // GIVEN a user holding a funder's grants
    const user = givenUser(grantsForRole(Role.Funder));

    // WHEN the row is derived
    const actual = toEntry(user);

    // THEN they are reported as a funder
    expect(actual.role).toBe(Role.Funder);
  });

  it("should report no role for a registered user who holds no grants", () => {
    // GIVEN a user whose access has not been granted yet
    const user = givenUser([]);

    // WHEN the row is derived
    const actual = toEntry(user);

    // THEN there is no role to name, and the row offers to grant one
    expect(actual.role).toBeNull();
    expect(actual.hasAccess).toBe(false);
  });

  it("should report access without a role when the grants held match none", () => {
    // GIVEN a user provisioned by hand, holding part of a role only
    const user = givenUser([grant("g1", Subject.Dashboard, Action.View)]);

    // WHEN the row is derived
    const actual = toEntry(user);

    // THEN no role is claimed, but the access they do hold is not hidden either
    expect(actual.role).toBeNull();
    expect(actual.hasAccess).toBe(true);
  });

  it("should name the role regardless of the institution its grants are scoped to", () => {
    // GIVEN an implementer provisioned against one institution rather than the whole deployment
    const user = givenUser(grantsForRole(Role.Implementer, "inst-1"));

    // WHEN the row is derived
    const actual = toEntry(user);

    // THEN their role is still named — the screen reports roles, not scopes
    expect(actual.role).toBe(Role.Implementer);
  });

  it("should keep the user as the API returned them, so the row can name them", () => {
    // GIVEN a user with an email and a name
    const user = givenUser([]);

    // WHEN the row is derived
    const actual = toEntry(user);

    // THEN the whole user is carried through untouched
    expect(actual.user).toEqual(user);
  });
});
