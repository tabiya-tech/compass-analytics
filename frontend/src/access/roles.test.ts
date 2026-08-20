import { describe, expect, it } from "vitest";
import { ASSIGNABLE_ROLES, DEFAULT_ASSIGNABLE_ROLE, ROLE_PERMISSIONS, Role, roleFromPermissions } from "@/access/roles";

const permissionsOf = (role: Role): string[] => [...ROLE_PERMISSIONS[role]];

describe("ASSIGNABLE_ROLES", () => {
  it("should offer implementer and funder, and never super_admin", () => {
    // GIVEN the roles the User Access screen can hand out
    // THEN only the two a funder may assign are offered — super_admin is bootstrapped by an operator
    expect(ASSIGNABLE_ROLES).toEqual([Role.Implementer, Role.Funder]);
  });

  it("should default to funder, and to a role that is actually on offer", () => {
    // GIVEN the role the grant dialog opens on
    // THEN it is funder, and one the dropdown lists
    expect(DEFAULT_ASSIGNABLE_ROLE).toBe(Role.Funder);
    expect(ASSIGNABLE_ROLES).toContain(DEFAULT_ASSIGNABLE_ROLE);
  });
});

describe("roleFromPermissions", () => {
  it("should name the implementer role from the permissions it covers", () => {
    // GIVEN a user holding exactly an implementer's permissions
    // WHEN their role is derived
    const actual = roleFromPermissions(permissionsOf(Role.Implementer));

    // THEN they are reported as an implementer
    expect(actual).toBe(Role.Implementer);
  });

  it("should name the funder role from the permissions it covers", () => {
    // GIVEN a user holding exactly a funder's permissions
    // WHEN their role is derived
    const actual = roleFromPermissions(permissionsOf(Role.Funder));

    // THEN they are reported as a funder
    expect(actual).toBe(Role.Funder);
  });

  it("should report a super admin as such, not as the funder they also cover", () => {
    // GIVEN a user holding every permission there is
    // WHEN their role is derived
    const actual = roleFromPermissions(permissionsOf(Role.SuperAdmin));

    // THEN the most privileged role wins, rather than one they merely happen to cover
    expect(actual).toBe(Role.SuperAdmin);
  });

  it("should report no role for a user who holds no permissions", () => {
    // GIVEN a registered user whose access has not been granted yet
    // WHEN their role is derived
    // THEN they hold no role, rather than the least privileged one
    expect(roleFromPermissions([])).toBeNull();
  });

  it("should report no role when the permissions held add up to none of them", () => {
    // GIVEN a user provisioned by hand, holding part of a role only
    // WHEN their role is derived
    // THEN no role is guessed, since naming one would overstate their access
    expect(roleFromPermissions(["dashboard:view"])).toBeNull();
  });

  it("should still name the role when extra permissions are held alongside it", () => {
    // GIVEN an implementer who was also given the institutions screen by hand
    const held = [...permissionsOf(Role.Implementer), "institutions:view"];

    // WHEN their role is derived
    const actual = roleFromPermissions(held);

    // THEN the role their grants cover is still named
    expect(actual).toBe(Role.Implementer);
  });
});
