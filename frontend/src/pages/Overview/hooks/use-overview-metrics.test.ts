import { describe, expect, it } from "vitest";
import type { AccessScope } from "@/access/AccessContext";
import { createInitialFilters, type FiltersState } from "@/filters/filters";
import { toOverviewMetricsRequest } from "./use-overview-metrics";

const GIVEN_FILTERS: FiltersState = createInitialFilters(new Date(2026, 6, 7));

describe("toOverviewMetricsRequest", () => {
  it("should ask for every institution when the grant covers the whole deployment", () => {
    // GIVEN a grant covering every institution
    const givenScope: AccessScope = { type: "all" };

    // WHEN the request is derived
    const actualRequest = toOverviewMetricsRequest(givenScope, GIVEN_FILTERS);

    // THEN it asks for all of them
    expect(actualRequest.institutions).toBe("all");
  });

  it("should ask only for the institutions the grant names", () => {
    // GIVEN a grant covering three named institutions
    const givenScope: AccessScope = { type: "institutions", institutionIds: ["inst-1", "inst-2", "inst-3"] };

    // WHEN the request is derived
    const actualRequest = toOverviewMetricsRequest(givenScope, GIVEN_FILTERS);

    // THEN it asks for exactly those
    expect(actualRequest.institutions).toEqual(["inst-1", "inst-2", "inst-3"]);
  });

  it("should narrow to the drilled-into institution, ignoring the rest of the grant", () => {
    // GIVEN a grant covering the deployment, drilled into one institution
    const givenScope: AccessScope = { type: "all" };
    const givenFilters: FiltersState = { ...GIVEN_FILTERS, institutionDrillDownId: "inst-3" };

    // WHEN the request is derived
    const actualRequest = toOverviewMetricsRequest(givenScope, givenFilters);

    // THEN only that institution is asked for
    expect(actualRequest.institutions).toEqual(["inst-3"]);
  });

  it("should carry the window, the granularity and the chip filters", () => {
    // GIVEN a window filtered to young jobseekers signing in with Google
    const givenScope: AccessScope = { type: "institutions", institutionIds: ["inst-1"] };
    const givenFilters: FiltersState = {
      ...GIVEN_FILTERS,
      dateRange: { start: "2025-07-08", end: "2026-07-07" },
      granularity: "month",
      audienceSegment: "youth",
      loginMethod: "google",
    };

    // WHEN the request is derived
    const actualRequest = toOverviewMetricsRequest(givenScope, givenFilters);

    // THEN the whole selection travels with it
    expect(actualRequest).toEqual({
      institutions: ["inst-1"],
      dateRange: { start: "2025-07-08", end: "2026-07-07" },
      granularity: "month",
      audienceSegment: "youth",
      loginMethod: "google",
    });
  });
});
