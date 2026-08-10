import { describe, it, expect } from "vitest";
import { mapMeToAccess } from "@/access/mapMeToAccess";
import { PERMISSIONS } from "@/access/AccessContext";
import type { MeResponse } from "@/user/user.types";

function givenMe(overrides: Partial<MeResponse> = {}): MeResponse {
  return {
    user_id: "u1",
    email: "u@example.com",
    name: "U",
    role: "implementer",
    scope: { type: "institutions", institution_ids: ["inst-a"] },
    active_modules: ["build-your-profile"],
    ...overrides,
  };
}

describe("mapMeToAccess", () => {
  it("should grant an implementer the jobseekers view but not the institutions view", () => {
    // GIVEN an implementer profile
    const me = givenMe({ role: "implementer" });

    // WHEN it is mapped to access
    const access = mapMeToAccess(me);

    // THEN they can view jobseekers but not institutions
    expect(access.permissions.has(PERMISSIONS.JOBSEEKERS_VIEW)).toBe(true);
    expect(access.permissions.has(PERMISSIONS.INSTITUTIONS_VIEW)).toBe(false);
  });

  it("should grant a funder the institutions view but not the jobseekers view", () => {
    // GIVEN a funder profile
    const me = givenMe({ role: "funder" });

    // WHEN it is mapped to access
    const access = mapMeToAccess(me);

    // THEN they can view institutions but not jobseekers
    expect(access.permissions.has(PERMISSIONS.INSTITUTIONS_VIEW)).toBe(true);
    expect(access.permissions.has(PERMISSIONS.JOBSEEKERS_VIEW)).toBe(false);
  });

  it("should map an 'all' scope to the all-institutions access scope", () => {
    // GIVEN a profile scoped to the whole deployment
    const me = givenMe({ scope: { type: "all", institution_ids: [] } });

    // WHEN it is mapped
    const access = mapMeToAccess(me);

    // THEN the access scope is "all"
    expect(access.scope).toEqual({ type: "all" });
  });

  it("should map an 'institutions' scope to the named institution list", () => {
    // GIVEN a profile scoped to specific institutions
    const me = givenMe({ scope: { type: "institutions", institution_ids: ["inst-a", "inst-b"] } });

    // WHEN it is mapped
    const access = mapMeToAccess(me);

    // THEN the institution ids are carried over
    expect(access.scope).toEqual({ type: "institutions", institutionIds: ["inst-a", "inst-b"] });
  });

  it("should carry the active modules through", () => {
    // GIVEN a profile with two active modules
    const me = givenMe({ active_modules: ["build-your-profile", "jobs"] });

    // WHEN it is mapped
    const access = mapMeToAccess(me);

    // THEN the active modules are preserved
    expect(access.activeModules).toEqual(["build-your-profile", "jobs"]);
  });
});
