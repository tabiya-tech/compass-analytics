import { describe, expect, it } from "vitest";
import { MODULE_IDS, type ModuleId } from "@/access/AccessContext";
import { getInstitutionColumns } from "./columns";

const FIXED_COLUMN_IDS = ["name", "region", "registered_users", "active_users"];

describe("getInstitutionColumns", () => {
  it("should give a four-module deployment a column per module, plus the skills reports column", () => {
    // GIVEN a deployment running every module
    const givenActiveModules: ModuleId[] = Object.values(MODULE_IDS);

    // WHEN the columns are built
    const actual = getInstitutionColumns(givenActiveModules).map((column) => column.id);

    // THEN the fixed columns are followed by one column per module, then skills reports
    expect(actual).toEqual([
      ...FIXED_COLUMN_IDS,
      "build-your-profile",
      "job-readiness",
      "career-explorer",
      "jobs",
      "skills_reports",
    ]);
  });

  it("should give a two-module deployment only those two module columns", () => {
    // GIVEN a deployment running Build Your Profile and Job readiness
    const givenActiveModules: ModuleId[] = [MODULE_IDS.BUILD_YOUR_PROFILE, MODULE_IDS.JOB_READINESS];

    // WHEN the columns are built
    const actual = getInstitutionColumns(givenActiveModules).map((column) => column.id);

    // THEN the modules it doesn't run get no columns
    expect(actual).toEqual([...FIXED_COLUMN_IDS, "build-your-profile", "job-readiness", "skills_reports"]);
  });

  it("should give a single-module deployment one module column", () => {
    // GIVEN a deployment running Career Explorer only
    const givenActiveModules: ModuleId[] = [MODULE_IDS.CAREER_EXPLORER];

    // WHEN the columns are built
    const actual = getInstitutionColumns(givenActiveModules).map((column) => column.id);

    // THEN only that module gets a column
    expect(actual).toEqual([...FIXED_COLUMN_IDS, "career-explorer"]);
  });

  it("should drop the skills reports column where Build Your Profile is not deployed", () => {
    // GIVEN a deployment running everything except Build Your Profile
    const givenActiveModules: ModuleId[] = [MODULE_IDS.JOB_READINESS, MODULE_IDS.CAREER_EXPLORER, MODULE_IDS.JOBS];

    // WHEN the columns are built
    const actual = getInstitutionColumns(givenActiveModules).map((column) => column.id);

    // THEN skills reports — a Build Your Profile output — is absent
    expect(actual).not.toContain("skills_reports");
  });

  it("should keep the canonical module order however the deployment lists its modules", () => {
    // GIVEN a deployment listing its modules back to front
    const givenActiveModules: ModuleId[] = [MODULE_IDS.JOBS, MODULE_IDS.CAREER_EXPLORER, MODULE_IDS.JOB_READINESS];

    // WHEN the columns are built
    const actual = getInstitutionColumns(givenActiveModules).map((column) => column.id);

    // THEN the module columns still read in the order the suite is used
    expect(actual).toEqual([...FIXED_COLUMN_IDS, "job-readiness", "career-explorer", "jobs"]);
  });

  it("should label each module column with its own copy, and make every metric column sortable", () => {
    // GIVEN a deployment running every module
    const givenActiveModules: ModuleId[] = Object.values(MODULE_IDS);

    // WHEN the columns are built
    const actual = getInstitutionColumns(givenActiveModules);

    // THEN each module column carries its own label key
    expect(actual.find((column) => column.id === MODULE_IDS.BUILD_YOUR_PROFILE)?.labelKey).toBe(
      "institutions.table.columns.buildYourProfile"
    );
    expect(actual.find((column) => column.id === MODULE_IDS.JOBS)?.labelKey).toBe("institutions.table.columns.jobs");
    // AND every numeric column can be sorted, while region is filtered instead
    expect(actual.filter((column) => column.numeric).every((column) => column.sortable)).toBe(true);
    expect(actual.find((column) => column.id === "region")).toMatchObject({ sortable: false, filterable: true });
  });
});
