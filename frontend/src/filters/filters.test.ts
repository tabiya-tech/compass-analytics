import { describe, expect, it } from "vitest";
import { createInitialFilters, deriveGranularity, getActiveFilters, spanInDays } from "./filters";

const GIVEN_TODAY = new Date(2026, 5, 15);
const GIVEN_START = "2026-01-01";

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe("deriveGranularity", () => {
  it.each([
    [0, "day"],
    [44, "day"],
    [45, "day"],
    [46, "week"],
    [199, "week"],
    [200, "week"],
    [201, "month"],
    [365, "month"],
  ] as const)("should derive '%s' granularity for a %i-day span", (offsetDays, expectedGranularity) => {
    // GIVEN a range spanning the given number of days
    const givenEnd = addDays(GIVEN_START, offsetDays);

    // WHEN deriving the granularity
    const actual = deriveGranularity({ start: GIVEN_START, end: givenEnd });

    // THEN it matches the expected boundary bucket
    expect(actual).toBe(expectedGranularity);
  });

  it("should derive the same granularity for a reversed range as its natural counterpart", () => {
    // GIVEN a range whose end precedes its start by 50 days
    const givenReversedRange = { start: addDays(GIVEN_START, 50), end: GIVEN_START };

    // WHEN deriving the granularity
    const actual = deriveGranularity(givenReversedRange);

    // THEN it matches the forward 50-day range's granularity
    expect(actual).toBe("week");
  });
});

describe("spanInDays", () => {
  it("should be unaffected by a DST transition inside the range", () => {
    // GIVEN a range crossing a UK daylight-saving transition
    // WHEN computing the span
    const actual = spanInDays("2026-03-28", "2026-03-30");

    // THEN it's exactly 2 whole days, since the calculation is UTC-based
    expect(actual).toBe(2);
  });

  it("should count a leap day correctly", () => {
    // GIVEN a range spanning Feb 29 in a leap year
    // WHEN computing the span
    const actual = spanInDays("2024-02-27", "2024-03-01");

    // THEN it counts all 3 days, including the leap day
    expect(actual).toBe(3);
  });
});

describe("createInitialFilters", () => {
  it("should default to a 365-day range ending today with 'month' granularity and no chip filters", () => {
    // GIVEN a fixed "today"
    // WHEN creating the initial filters
    const actual = createInitialFilters(GIVEN_TODAY);

    // THEN the range spans the last year, granularity is "month", and no chips are set
    expect(actual.dateRange).toEqual({ start: "2025-06-15", end: "2026-06-15" });
    expect(actual.granularity).toBe("month");
    expect(actual.audienceSegment).toBeNull();
    expect(actual.loginMethod).toBeNull();
    expect(actual.institutionDrillDownId).toBeNull();
  });
});

describe("getActiveFilters", () => {
  it("should return an empty list when no chip filters are set", () => {
    // GIVEN the initial filters state
    // WHEN reading the active filters
    const actual = getActiveFilters(createInitialFilters(GIVEN_TODAY));

    // THEN there are none
    expect(actual).toEqual([]);
  });

  it("should list active filters in institution, audience segment, login method order", () => {
    // GIVEN a state with all three chip filters set, assigned out of order
    const givenState = {
      ...createInitialFilters(GIVEN_TODAY),
      loginMethod: "email" as const,
      institutionDrillDownId: "inst-1",
      audienceSegment: "youth" as const,
    };

    // WHEN reading the active filters
    const actual = getActiveFilters(givenState);

    // THEN they come back in the stable display order
    expect(actual).toEqual([
      { key: "institutionDrillDownId", value: "inst-1" },
      { key: "audienceSegment", value: "youth" },
      { key: "loginMethod", value: "email" },
    ]);
  });

  it("should omit a filter that isn't set", () => {
    // GIVEN a state with only the audience segment set
    const givenState = { ...createInitialFilters(GIVEN_TODAY), audienceSegment: "women" as const };

    // WHEN reading the active filters
    const actual = getActiveFilters(givenState);

    // THEN only that one is present
    expect(actual).toEqual([{ key: "audienceSegment", value: "women" }]);
  });
});
