import { describe, expect, it } from "vitest";
import { MODULE_STATUSES } from "@/jobseekers/jobseekers.types";
import { formatDay, MODULE_STATUS_LABEL_KEYS, NO_VALUE } from "./utils";

describe("formatDay", () => {
  it("should write a recorded day the way a partner reads it", () => {
    // GIVEN a day the deployment recorded
    const givenDay = "2026-07-07";

    // WHEN it is formatted for the screen
    const actualLabel = formatDay(givenDay);

    // THEN it reads as a day, a month and a year
    expect(actualLabel).toBe("07 Jul 2026");
  });

  it("should keep the day the deployment recorded, whatever timezone the reader is in", () => {
    // GIVEN a day at the very start of the year, where a westward offset would slip into the previous one
    const givenDay = "2026-01-01";

    // WHEN it is formatted
    const actualLabel = formatDay(givenDay);

    // THEN the day recorded is the day shown
    expect(actualLabel).toBe("01 Jan 2026");
  });

  it("should stand in for a figure the deployment never recorded", () => {
    // GIVEN a jobseeker who has never logged in, so there is no day to show
    const givenDay = null;

    // WHEN it is formatted
    const actualLabel = formatDay(givenDay);

    // THEN the cell reads as empty on purpose rather than looking broken
    expect(actualLabel).toBe(NO_VALUE);
  });

  it("should stand in for a figure the endpoint left out entirely", () => {
    // GIVEN a response that omitted the day
    const givenDay = undefined;

    // WHEN it is formatted
    const actualLabel = formatDay(givenDay);

    // THEN the same stand-in is shown
    expect(actualLabel).toBe(NO_VALUE);
  });

  it("should show a day it cannot read as it was given, rather than a nonsense date", () => {
    // GIVEN a value that is not a date at all
    const givenDay = "not-a-date";

    // WHEN it is formatted
    const actualLabel = formatDay(givenDay);

    // THEN it is passed through untouched
    expect(actualLabel).toBe(givenDay);
  });
});

describe("MODULE_STATUS_LABEL_KEYS", () => {
  it("should name every status a jobseeker can be in", () => {
    // GIVEN the statuses the API can report
    // WHEN each is looked up
    const actualKeys = MODULE_STATUSES.map((status) => MODULE_STATUS_LABEL_KEYS[status]);

    // THEN none of them is left without a label
    expect(actualKeys).toEqual([
      "jobseekers.status.notStarted",
      "jobseekers.status.inProgress",
      "jobseekers.status.completed",
    ]);
  });
});
