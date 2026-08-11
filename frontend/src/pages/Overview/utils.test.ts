import { describe, expect, it } from "vitest";
import { formatDateRangeLabel, formatMonthYear, formatPeriodLabel, listPeriods } from "./utils";

describe("listPeriods", () => {
  it("should list one bucket per day for a day-granularity range, both ends included", () => {
    // GIVEN a four-day range
    const givenRange = { start: "2026-03-01", end: "2026-03-04" };

    // WHEN the buckets are listed by day
    const actualPeriods = listPeriods(givenRange, "day");

    // THEN every day in the range is a bucket
    expect(actualPeriods).toEqual(["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04"]);
  });

  it("should list one bucket per week, starting on the range's first day", () => {
    // GIVEN a range of just over two weeks
    const givenRange = { start: "2026-03-02", end: "2026-03-17" };

    // WHEN the buckets are listed by week
    const actualPeriods = listPeriods(givenRange, "week");

    // THEN each bucket starts seven days after the previous one
    expect(actualPeriods).toEqual(["2026-03-02", "2026-03-09", "2026-03-16"]);
  });

  it("should list one bucket per calendar month, including the month the range starts in", () => {
    // GIVEN a range starting mid-month and ending mid-month
    const givenRange = { start: "2025-11-20", end: "2026-02-03" };

    // WHEN the buckets are listed by month
    const actualPeriods = listPeriods(givenRange, "month");

    // THEN the partial months at both ends are still reported in full
    expect(actualPeriods).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("should list the single bucket containing a one-day range", () => {
    // GIVEN a range that starts and ends on the same day
    const givenRange = { start: "2026-03-01", end: "2026-03-01" };

    // WHEN the buckets are listed by day
    const actualPeriods = listPeriods(givenRange, "day");

    // THEN that one day is the only bucket
    expect(actualPeriods).toEqual(["2026-03-01"]);
  });

  it("should list no buckets when the range ends before it starts", () => {
    // GIVEN a range whose end precedes its start
    const givenRange = { start: "2026-03-10", end: "2026-03-01" };

    // WHEN the buckets are listed
    const actualPeriods = listPeriods(givenRange, "day");

    // THEN there is nothing to plot
    expect(actualPeriods).toEqual([]);
  });

  it("should cap the bucket count rather than iterate a nonsensical range", () => {
    // GIVEN a range spanning several centuries
    const givenRange = { start: "1900-01-01", end: "2400-01-01" };

    // WHEN the buckets are listed by day
    const actualPeriods = listPeriods(givenRange, "day");

    // THEN the listing stops at the safety cap
    expect(actualPeriods).toHaveLength(400);
  });
});

describe("formatPeriodLabel", () => {
  it("should label a month bucket with its short month and two-digit year", () => {
    // GIVEN a month bucket
    const givenPeriod = "2025-07";

    // WHEN it is labelled
    const actualLabel = formatPeriodLabel(givenPeriod, "month");

    // THEN it reads as the month and year
    expect(actualLabel).toBe("Jul '25");
  });

  it.each([["week"], ["day"]] as const)("should label a %s bucket with its day and month", (givenGranularity) => {
    // GIVEN a bucket starting on the 12th of July
    const givenPeriod = "2025-07-12";

    // WHEN it is labelled
    const actualLabel = formatPeriodLabel(givenPeriod, givenGranularity);

    // THEN it reads as the day and month
    expect(actualLabel).toBe("12 Jul");
  });

  it("should fall back to the raw key when the period isn't a date", () => {
    // GIVEN a period key that isn't a date
    const givenPeriod = "not-a-date";

    // WHEN it is labelled
    const actualLabel = formatPeriodLabel(givenPeriod, "month");

    // THEN the key itself shows, rather than "Invalid Date"
    expect(actualLabel).toBe("not-a-date");
  });
});

describe("formatMonthYear", () => {
  it("should format a full date as its month and two-digit year", () => {
    // GIVEN a calendar date late in the year
    const givenDate = "2026-12-31";

    // WHEN it is formatted
    const actualLabel = formatMonthYear(givenDate);

    // THEN only the month and year show
    expect(actualLabel).toBe("Dec '26");
  });
});

describe("formatDateRangeLabel", () => {
  it("should read as a span when the range covers more than one month", () => {
    // GIVEN a range across a year boundary
    const givenRange = { start: "2025-07-08", end: "2026-07-07" };

    // WHEN it is labelled
    const actualLabel = formatDateRangeLabel(givenRange);

    // THEN both ends show, separated by an en dash
    expect(actualLabel).toBe("Jul '25 – Jul '26");
  });

  it("should read as a single month when the range sits inside one", () => {
    // GIVEN a range within one month
    const givenRange = { start: "2026-07-01", end: "2026-07-28" };

    // WHEN it is labelled
    const actualLabel = formatDateRangeLabel(givenRange);

    // THEN the month is stated once
    expect(actualLabel).toBe("Jul '26");
  });
});
