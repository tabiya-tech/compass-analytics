import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import type { OverviewMetricsRequest } from "@/pages/Overview/overview.types";
import { listPeriods } from "@/pages/Overview/utils";
import {
  buildOverviewMetricsQuery,
  OVERVIEW_API_BASE,
  OverviewMetricsApiError,
  OverviewMetricsService,
} from "./OverviewMetrics.service";

const GIVEN_YEAR_TO_JULY: OverviewMetricsRequest = {
  institutions: ["inst-1"],
  dateRange: { start: "2025-07-08", end: "2026-07-07" },
  granularity: "month",
};

const GIVEN_ALL_INSTITUTIONS: OverviewMetricsRequest = { ...GIVEN_YEAR_TO_JULY, institutions: "all" };

function service(): OverviewMetricsService {
  return OverviewMetricsService.getInstance();
}

describe("buildOverviewMetricsQuery", () => {
  it("should send the scope, the range and the granularity, and nothing for the unset filters", () => {
    // GIVEN a request with no chip filters applied
    // WHEN the query is built
    const actualQuery = buildOverviewMetricsQuery(GIVEN_YEAR_TO_JULY);

    // THEN the scope, range and granularity are sent
    expect(actualQuery.get("institutions")).toBe("inst-1");
    expect(actualQuery.get("start")).toBe("2025-07-08");
    expect(actualQuery.get("end")).toBe("2026-07-07");
    expect(actualQuery.get("granularity")).toBe("month");
    // AND the filters are absent rather than empty
    expect(actualQuery.has("audienceSegment")).toBe(false);
    expect(actualQuery.has("loginMethod")).toBe(false);
  });

  it("should send several institutions as one comma-separated param", () => {
    // GIVEN a grant covering three institutions
    const givenRequest: OverviewMetricsRequest = {
      ...GIVEN_YEAR_TO_JULY,
      institutions: ["inst-1", "inst-2", "inst-3"],
    };

    // WHEN the query is built
    const actualQuery = buildOverviewMetricsQuery(givenRequest);

    // THEN they travel in a single param
    expect(actualQuery.get("institutions")).toBe("inst-1,inst-2,inst-3");
  });

  it("should send every institution as the 'all' sentinel", () => {
    // GIVEN a grant covering the whole deployment
    // WHEN the query is built
    const actualQuery = buildOverviewMetricsQuery(GIVEN_ALL_INSTITUTIONS);

    // THEN the scope is stated once, without naming institutions
    expect(actualQuery.get("institutions")).toBe("all");
  });

  it("should send the applied chip filters", () => {
    // GIVEN a request narrowed to young jobseekers who sign in with Google
    const givenRequest: OverviewMetricsRequest = {
      ...GIVEN_YEAR_TO_JULY,
      audienceSegment: "youth",
      loginMethod: "google",
    };

    // WHEN the query is built
    const actualQuery = buildOverviewMetricsQuery(givenRequest);

    // THEN both filters are sent
    expect(actualQuery.get("audienceSegment")).toBe("youth");
    expect(actualQuery.get("loginMethod")).toBe("google");
  });
});

describe("OverviewMetricsService.getOverviewMetrics", () => {
  it("should return metrics scoped to the one institution in scope, naming it", async () => {
    // GIVEN a grant covering a single institution
    // WHEN the overview metrics are fetched
    const actualMetrics = await service().getOverviewMetrics(GIVEN_YEAR_TO_JULY);

    // THEN the payload reports on that institution by name
    expect(actualMetrics.scope).toEqual({
      type: "institution",
      institutionId: "inst-1",
      institutionName: "Ndola Livelihoods Trust",
    });
  });

  it("should return an aggregated portfolio when the grant covers every institution", async () => {
    // GIVEN a grant covering the whole deployment
    // WHEN the overview metrics are fetched
    const actualMetrics = await service().getOverviewMetrics(GIVEN_ALL_INSTITUTIONS);

    // THEN the payload reports a count of institutions rather than naming one
    expect(actualMetrics.scope).toEqual({ type: "portfolio", institutionCount: 5 });
  });

  it("should report a larger population for the portfolio than for one of its institutions", async () => {
    // GIVEN the same window read at both scopes
    // WHEN both are fetched
    const actualPortfolio = await service().getOverviewMetrics(GIVEN_ALL_INSTITUTIONS);
    const actualInstitution = await service().getOverviewMetrics(GIVEN_YEAR_TO_JULY);

    // THEN the portfolio aggregates its members rather than sampling one
    expect(actualPortfolio.cumulativeUsers.total).toBeGreaterThan(actualInstitution.cumulativeUsers.total);
  });

  it("should echo the requested window and bucket the reach series by the requested granularity", async () => {
    // GIVEN a year-long window read by month
    const givenPeriods = listPeriods(GIVEN_YEAR_TO_JULY.dateRange, "month");

    // WHEN the overview metrics are fetched
    const actualMetrics = await service().getOverviewMetrics(GIVEN_YEAR_TO_JULY);

    // THEN the response states the window it answers for
    expect(actualMetrics.dateRange).toEqual(GIVEN_YEAR_TO_JULY.dateRange);
    expect(actualMetrics.granularity).toBe("month");
    // AND there is one reach bucket per month in it
    expect(actualMetrics.reachSeries.map((point) => point.period)).toEqual(givenPeriods);
  });

  it("should return finer buckets when the same window is read by week", async () => {
    // GIVEN a six-week window read by week
    const givenRequest: OverviewMetricsRequest = {
      ...GIVEN_YEAR_TO_JULY,
      dateRange: { start: "2026-05-01", end: "2026-06-12" },
      granularity: "week",
    };

    // WHEN the overview metrics are fetched
    const actualMetrics = await service().getOverviewMetrics(givenRequest);

    // THEN the series is bucketed weekly
    expect(actualMetrics.granularity).toBe("week");
    expect(actualMetrics.reachSeries).toHaveLength(listPeriods(givenRequest.dateRange, "week").length);
  });

  it("should return a complete dashboard payload, with every panel's data present", async () => {
    // GIVEN a grant covering a single institution
    // WHEN the overview metrics are fetched
    const actualMetrics = await service().getOverviewMetrics(GIVEN_YEAR_TO_JULY);

    // THEN the tiles have their figures
    expect(actualMetrics.cumulativeUsers.total).toBeGreaterThan(0);
    expect(actualMetrics.activeUsers.count).toBeGreaterThan(0);
    expect(actualMetrics.activeUsers.windowDays).toBe(30);
    expect(actualMetrics.averageSessionMinutes).toBeGreaterThan(0);
    // AND the sparkline has a series that only ever rises
    const actualSparkline = actualMetrics.dailySeries.map((point) => point.users);
    expect(actualSparkline.length).toBeGreaterThan(1);
    expect([...actualSparkline].sort((a, b) => a - b)).toEqual(actualSparkline);
    // AND the login split and its centre figure are there
    expect(actualMetrics.loginMethods.map((slice) => slice.method)).toEqual(["google", "email"]);
    expect(actualMetrics.averageLoginsPerUser).toBeGreaterThan(0);
  });

  it("should narrow the login split to the filtered method", async () => {
    // GIVEN a request filtered to Google sign-ins
    const givenRequest: OverviewMetricsRequest = { ...GIVEN_YEAR_TO_JULY, loginMethod: "google" };

    // WHEN the overview metrics are fetched
    const actualMetrics = await service().getOverviewMetrics(givenRequest);

    // THEN only that method is left in the split
    expect(actualMetrics.loginMethods.map((slice) => slice.method)).toEqual(["google"]);
  });

  it("should report a smaller population once an audience segment is filtered", async () => {
    // GIVEN the same window, read unfiltered and then narrowed to youth
    // WHEN both are fetched
    const actualUnfiltered = await service().getOverviewMetrics(GIVEN_YEAR_TO_JULY);
    const actualFiltered = await service().getOverviewMetrics({ ...GIVEN_YEAR_TO_JULY, audienceSegment: "youth" });

    // THEN the filtered slice is a subset of the whole
    expect(actualFiltered.cumulativeUsers.total).toBeLessThan(actualUnfiltered.cumulativeUsers.total);
  });

  it("should return the same figures for the same request, so the numbers never drift between renders", async () => {
    // GIVEN one request
    // WHEN it is fetched twice
    const actualFirst = await service().getOverviewMetrics(GIVEN_YEAR_TO_JULY);
    const actualSecond = await service().getOverviewMetrics(GIVEN_YEAR_TO_JULY);

    // THEN both responses are identical
    expect(actualSecond).toEqual(actualFirst);
  });

  it("should throw an api error carrying the status when the endpoint fails", async () => {
    // GIVEN the metrics endpoint is failing
    server.use(http.get(`${OVERVIEW_API_BASE}/metrics`, () => new HttpResponse(null, { status: 500 })));

    // WHEN the overview metrics are fetched
    const actualPromise = service().getOverviewMetrics(GIVEN_YEAR_TO_JULY);

    // THEN it rejects with the api error, carrying the status
    await expect(actualPromise).rejects.toBeInstanceOf(OverviewMetricsApiError);
    await expect(actualPromise).rejects.toMatchObject({ status: 500 });
  });

  it("should reuse a single instance, so callers share one service", () => {
    // GIVEN the service has been resolved once
    const givenService = OverviewMetricsService.getInstance();

    // WHEN it is resolved again
    const actualService = OverviewMetricsService.getInstance();

    // THEN it is the same instance
    expect(actualService).toBe(givenService);
  });
});
