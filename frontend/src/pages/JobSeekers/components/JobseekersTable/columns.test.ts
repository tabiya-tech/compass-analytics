import { describe, expect, it } from "vitest";
import { MODULE_IDS } from "@/access/AccessContext";
import { getJobseekerColumns } from "./columns";

describe("getJobseekerColumns", () => {
  it("should always carry the jobseeker, their score, their dates and their skills", () => {
    // GIVEN a deployment running no modules at all
    // WHEN the columns are built
    const actualColumns = getJobseekerColumns([]);

    // THEN the columns that describe the person, rather than a module, are all there
    expect(actualColumns.map((column) => column.id)).toEqual([
      "name",
      "profile_score_pct",
      "registered_at",
      "last_login_at",
      "skills",
    ]);
  });

  it("should add a status column for each deployed module, in suite order", () => {
    // GIVEN a deployment listing its modules out of suite order
    const givenActiveModules = [MODULE_IDS.CAREER_EXPLORER, MODULE_IDS.BUILD_YOUR_PROFILE];

    // WHEN the columns are built
    const actualColumns = getJobseekerColumns(givenActiveModules);

    // THEN the module columns follow the suite's order, not the deployment's
    expect(actualColumns.map((column) => column.id)).toEqual([
      "name",
      "profile_score_pct",
      "registered_at",
      "last_login_at",
      MODULE_IDS.BUILD_YOUR_PROFILE,
      MODULE_IDS.CAREER_EXPLORER,
      "skills",
    ]);
  });

  it("should leave Jobs to the profile drill-down rather than give it a roster column", () => {
    // GIVEN a deployment running every module, Jobs included
    const givenActiveModules = Object.values(MODULE_IDS);

    // WHEN the columns are built
    const actualColumns = getJobseekerColumns(givenActiveModules);

    // THEN Jobs has no column of its own
    expect(actualColumns.map((column) => column.id)).not.toContain(MODULE_IDS.JOBS);
  });

  it("should mark the module columns as filterable and the person's columns as sortable", () => {
    // GIVEN a deployment running Build Your Profile
    // WHEN the columns are built
    const actualColumns = getJobseekerColumns([MODULE_IDS.BUILD_YOUR_PROFILE]);
    const byId = Object.fromEntries(actualColumns.map((column) => [column.id, column]));

    // THEN a module column filters by status and never sorts
    expect(byId[MODULE_IDS.BUILD_YOUR_PROFILE].moduleId).toBe(MODULE_IDS.BUILD_YOUR_PROFILE);
    expect(byId[MODULE_IDS.BUILD_YOUR_PROFILE].sortable).toBe(false);
    // AND the person's own columns sort but carry no module
    expect(byId.name.sortable).toBe(true);
    expect(byId.profile_score_pct.sortable).toBe(true);
    expect(byId.profile_score_pct.numeric).toBe(true);
    expect(byId.name.moduleId).toBeUndefined();
    // AND the skills column does neither — it opens the report instead
    expect(byId.skills.sortable).toBe(false);
    expect(byId.skills.moduleId).toBeUndefined();
  });
});
