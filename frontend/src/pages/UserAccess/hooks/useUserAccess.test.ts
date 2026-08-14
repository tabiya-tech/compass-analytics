import { describe, expect, it } from "vitest";
import { Action, Subject } from "@/access/ability";
import { ALL_INSTITUTIONS, type ManagedUser } from "@/user/user.types";
import { toEntry } from "./useUserAccess";

function givenUser(grants: ManagedUser["grants"]): ManagedUser {
  return { user_id: "user-7", email: "v@example.com", name: "Vaani Mumba", grants };
}

const grant = (grantId: string, subject: Subject, action: Action, institutionId: string) => ({
  grant_id: grantId,
  subject,
  action,
  institution_id: institutionId,
});

describe("toEntry", () => {
  it("should find the user's dashboard grant among their other grants", () => {
    // GIVEN a user holding several grants, one of them dashboard:view
    const dashboard = grant("g2", Subject.Dashboard, Action.View, "inst-1");
    const user = givenUser([grant("g1", Subject.Jobseekers, Action.View, "inst-1"), dashboard]);

    // WHEN the row is derived
    const actual = toEntry(user);

    // THEN the dashboard grant is the one picked out
    expect(actual.dashboardGrant).toEqual(dashboard);
  });

  it("should report no dashboard grant when the user holds none", () => {
    // GIVEN a user with grants, none of them dashboard:view
    const user = givenUser([grant("g1", Subject.Jobseekers, Action.View, "inst-1")]);

    // WHEN the row is derived
    const actual = toEntry(user);

    // THEN the row offers the grant rather than reporting one
    expect(actual.dashboardGrant).toBeNull();
  });

  it("should scope the row to the institution the dashboard grant already covers", () => {
    // GIVEN a user whose dashboard grant is on a different institution from their other grants
    const user = givenUser([
      grant("g1", Subject.Jobseekers, Action.View, "inst-1"),
      grant("g2", Subject.Dashboard, Action.View, "inst-2"),
    ]);

    // WHEN the row is derived
    const actual = toEntry(user);

    // THEN the dashboard grant's own scope wins, since that is the access shown
    expect(actual.institutionId).toBe("inst-2");
  });

  it("should scope a new grant to the institution the user's grants agree on", () => {
    // GIVEN a user with no dashboard grant, whose grants all sit on one institution
    const user = givenUser([
      grant("g1", Subject.Jobseekers, Action.View, "inst-1"),
      grant("g2", Subject.Account, Action.View, "inst-1"),
    ]);

    // WHEN the row is derived
    const actual = toEntry(user);

    // THEN that institution is the one a new grant would be scoped to
    expect(actual.institutionId).toBe("inst-1");
  });

  it("should carry the deployment-wide sentinel through as the scope", () => {
    // GIVEN a user granted across every institution
    const user = givenUser([grant("g1", Subject.Jobseekers, Action.View, ALL_INSTITUTIONS)]);

    // WHEN the row is derived
    const actual = toEntry(user);

    // THEN the sentinel is kept, so the row can name the scope as deployment-wide
    expect(actual.institutionId).toBe(ALL_INSTITUTIONS);
  });

  it("should refuse to guess when the user's grants span institutions", () => {
    // GIVEN a user with no dashboard grant, whose grants disagree on the institution
    const user = givenUser([
      grant("g1", Subject.Jobseekers, Action.View, "inst-1"),
      grant("g2", Subject.Account, Action.View, "inst-2"),
    ]);

    // WHEN the row is derived
    const actual = toEntry(user);

    // THEN no institution is chosen, rather than picking whichever the server listed first
    expect(actual.institutionId).toBeNull();
  });

  it("should report no institution for a user who holds no grants at all", () => {
    // GIVEN a registered user who has not been provisioned yet
    const user = givenUser([]);

    // WHEN the row is derived
    const actual = toEntry(user);

    // THEN there is nothing to scope a grant to
    expect(actual.institutionId).toBeNull();
    expect(actual.dashboardGrant).toBeNull();
  });
});
