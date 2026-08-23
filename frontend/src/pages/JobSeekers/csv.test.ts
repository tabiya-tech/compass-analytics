import { describe, expect, it } from "vitest";
import { MODULE_IDS } from "@/access/AccessContext";
import type { JobseekerSummary } from "@/jobseekers/jobseekers.types";
import { buildJobseekersCsv, jobseekersCsvFilename, type JobseekersCsvLabels } from "./csv";

const givenLabels: JobseekersCsvLabels = {
  id: "Jobseeker ID",
  name: "Jobseeker",
  institution: "Institution",
  profileScore: "Profile score (%)",
  registered: "Registered",
  lastLogin: "Last login",
  skillsReport: "Skills report",
  skillsCount: "Skills count",
  skills: "Skills",
  modules: {
    [MODULE_IDS.BUILD_YOUR_PROFILE]: "Build Your Profile",
    [MODULE_IDS.JOB_READINESS]: "Job readiness",
    [MODULE_IDS.CAREER_EXPLORER]: "Career Explorer",
    [MODULE_IDS.JOBS]: "Jobs",
  },
  statuses: { not_started: "Not started", in_progress: "In progress", completed: "Completed" },
  reportReady: "Ready",
  reportNotReady: "Not ready",
};

const givenCompletedJobseeker: JobseekerSummary = {
  id: "JS-10230",
  name: "María González",
  institution_id: "inst-1",
  institution_name: "Mazabuka Livelihoods Trust",
  profile_score_pct: 100,
  registered_at: "2026-02-05",
  last_login_at: "2026-07-04",
  module_status: {
    [MODULE_IDS.BUILD_YOUR_PROFILE]: "completed",
    [MODULE_IDS.JOB_READINESS]: "completed",
    [MODULE_IDS.CAREER_EXPLORER]: "completed",
    [MODULE_IDS.JOBS]: "in_progress",
  },
  skills_report_ready: true,
  skills: ["Customer service", "Cash handling"],
};

const givenUnstartedJobseeker: JobseekerSummary = {
  id: "JS-10231",
  name: "Kabelo Molefe",
  institution_id: "inst-1",
  institution_name: "Mazabuka Livelihoods Trust",
  profile_score_pct: 0,
  registered_at: "2026-03-28",
  last_login_at: "2026-04-10",
  module_status: {},
  skills_report_ready: false,
  skills: [],
};

const ALL_MODULES = [
  MODULE_IDS.BUILD_YOUR_PROFILE,
  MODULE_IDS.JOB_READINESS,
  MODULE_IDS.CAREER_EXPLORER,
  MODULE_IDS.JOBS,
];

function rowsOf(csv: string): string[][] {
  return csv.split("\n").map((line) => line.split(","));
}

describe("buildJobseekersCsv", () => {
  it("should head the file with the same columns the table shows, plus the ones only the file has room for", () => {
    // GIVEN a deployment running every module
    // WHEN the roster is exported
    const actualCsv = buildJobseekersCsv([givenCompletedJobseeker], ALL_MODULES, givenLabels);

    // THEN the heading row carries the table's columns and the extras a spreadsheet can hold
    expect(rowsOf(actualCsv)[0]).toEqual([
      "Jobseeker ID",
      "Jobseeker",
      "Institution",
      "Profile score (%)",
      "Registered",
      "Last login",
      "Build Your Profile",
      "Job readiness",
      "Career Explorer",
      "Jobs",
      "Skills report",
      "Skills count",
      "Skills",
    ]);
  });

  it("should write one row per jobseeker, reading exactly as the table does", () => {
    // GIVEN a jobseeker who finished their Skills Report
    // WHEN the roster is exported
    const actualCsv = buildJobseekersCsv([givenCompletedJobseeker], ALL_MODULES, givenLabels);

    // THEN their row repeats the dates, score and statuses as the table renders them
    expect(rowsOf(actualCsv)[1]).toEqual([
      "JS-10230",
      "María González",
      "Mazabuka Livelihoods Trust",
      "100",
      "05 Feb 2026",
      "04 Jul 2026",
      "Completed",
      "Completed",
      "Completed",
      "In progress",
      "Ready",
      "2",
      // Semicolon-joined, so a spreadsheet reads the whole list as one cell without quoting.
      "Customer service; Cash handling",
    ]);
  });

  it("should say a report is not ready rather than claim zero skills were found", () => {
    // GIVEN a jobseeker who has not completed Build Your Profile
    // WHEN the roster is exported
    const actualCsv = buildJobseekersCsv([givenUnstartedJobseeker], ALL_MODULES, givenLabels);
    const actualRow = rowsOf(actualCsv)[1];

    // THEN every module reads as not started, and the report is reported missing rather than empty
    expect(actualRow.slice(6, 10)).toEqual(["Not started", "Not started", "Not started", "Not started"]);
    expect(actualRow.slice(10)).toEqual(["Not ready", "0", ""]);
  });

  it("should write a dash for a date that was never recorded, so the column never shifts", () => {
    // GIVEN a jobseeker who has registered but never logged in
    const givenNeverLoggedIn: JobseekerSummary = { ...givenUnstartedJobseeker, last_login_at: null };

    // WHEN the roster is exported
    const actualCsv = buildJobseekersCsv([givenNeverLoggedIn], [], givenLabels);

    // THEN the missing date is written as a dash rather than left empty
    expect(rowsOf(actualCsv)[1][5]).toBe("\u2014");
  });

  it("should carry a column only for the modules the deployment runs", () => {
    // GIVEN a deployment running Career Explorer only
    const givenActiveModules = [MODULE_IDS.CAREER_EXPLORER];

    // WHEN the roster is exported
    const actualCsv = buildJobseekersCsv([givenCompletedJobseeker], givenActiveModules, givenLabels);

    // THEN only that module has a column
    expect(rowsOf(actualCsv)[0]).toContain("Career Explorer");
    expect(rowsOf(actualCsv)[0]).not.toContain("Build Your Profile");
  });

  it("should keep the rows in the order they were given, so the file matches the sorted table", () => {
    // GIVEN two jobseekers in the order the table sorted them
    const givenRoster = [givenUnstartedJobseeker, givenCompletedJobseeker];

    // WHEN the roster is exported
    const actualCsv = buildJobseekersCsv(givenRoster, ALL_MODULES, givenLabels);

    // THEN the file lists them in that same order
    expect(
      rowsOf(actualCsv)
        .slice(1)
        .map((row) => row[0])
    ).toEqual(["JS-10231", "JS-10230"]);
  });

  it("should quote any value that would otherwise break the column layout", () => {
    // GIVEN a jobseeker whose name carries a comma and a quote
    const givenAwkwardJobseeker: JobseekerSummary = {
      ...givenUnstartedJobseeker,
      name: 'Molefe, Kabelo "KB"',
    };

    // WHEN the roster is exported
    const actualCsv = buildJobseekersCsv([givenAwkwardJobseeker], [], givenLabels);

    // THEN the value is quoted and its own quotes are doubled, so it stays one field
    expect(actualCsv).toContain('"Molefe, Kabelo ""KB"""');
  });

  it("should produce an empty body when there is nothing to export", () => {
    // GIVEN no jobseekers
    // WHEN the roster is exported
    const actualCsv = buildJobseekersCsv([], ALL_MODULES, givenLabels);

    // THEN the file is the heading row alone
    expect(rowsOf(actualCsv)).toHaveLength(1);
  });
});

describe("jobseekersCsvFilename", () => {
  it("should date the file by the day it was taken", () => {
    // GIVEN the day the export is taken
    const givenToday = new Date(2026, 7, 18);

    // WHEN the filename is built
    const actualFilename = jobseekersCsvFilename(givenToday);

    // THEN it carries that date
    expect(actualFilename).toBe("compass-jobseekers-2026-08-18.csv");
  });
});
