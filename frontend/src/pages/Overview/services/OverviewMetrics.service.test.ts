import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import type { ReachResponse } from "@/analytics/analytics.types";
import type { OverviewMetricsRequest } from "@/pages/Overview/overview.types";
import { mapReachToOverviewMetrics } from "./OverviewMetrics.adapter";
import { OverviewMetricsApiError, OverviewMetricsService, REACH_API_PATH } from "./OverviewMetrics.service";

const GIVEN_REACH: ReachResponse = {
  summary: {
    total_users: 12_000,
    active_users_30d: 3_000,
    total_logins: 48_000,
    avg_logins_per_user: 4.0,
    avg_session_minutes: 22,
  },
  series: [
    { label: "2026-01", cumulative: 10_000, added: 900, new_users: 900, returning: 9_100, logins: 6_000 },
    { label: "2026-02", cumulative: 11_000, added: 1_000, new_users: 1_000, returning: 10_000, logins: 7_000 },
    { label: "2026-03", cumulative: 12_000, added: 1_200, new_users: 1_200, returning: 10_800, logins: 8_000 },
  ],
};

const GIVEN_REQUEST: OverviewMetricsRequest = {
  institutions: ["inst-1"],
  dateRange: { start: "2026-01-01", end: "2026-03-31" },
  granularity: "month",
};

function service(): OverviewMetricsService {
  return OverviewMetricsService.getInstance();
}

describe("mapReachToOverviewMetrics", () => {
  it("should map summary totals onto the tile metrics", () => {
    // GIVEN a reach response with known summary figures
    // WHEN mapped
    const actual = mapReachToOverviewMetrics(GIVEN_REACH, GIVEN_REQUEST);

    // THEN the tiles carry those figures
    expect(actual.cumulativeUsers.total).toBe(12_000);
    expect(actual.activeUsers.count).toBe(3_000);
    expect(actual.activeUsers.windowDays).toBe(30);
    expect(actual.averageSessionMinutes).toBe(22);
    expect(actual.averageLoginsPerUser).toBe(4.0);
  });

  it("should compute active users share as a percentage of total", () => {
    // GIVEN 3 000 active out of 12 000 total
    const actual = mapReachToOverviewMetrics(GIVEN_REACH, GIVEN_REQUEST);

    // THEN the share is 25 %
    expect(actual.activeUsers.shareOfUsersPercentage).toBe(25);
  });

  it("should map series labels and user counts onto the reach series", () => {
    // GIVEN a three-bucket series
    const actual = mapReachToOverviewMetrics(GIVEN_REACH, GIVEN_REQUEST);

    // THEN each bucket is mapped by label, new users, and returning users
    expect(actual.reachSeries).toEqual([
      { period: "2026-01", newUsers: 900, returningUsers: 9_100 },
      { period: "2026-02", newUsers: 1_000, returningUsers: 10_000 },
      { period: "2026-03", newUsers: 1_200, returningUsers: 10_800 },
    ]);
  });

  it("should map the cumulative series onto the daily sparkline", () => {
    // GIVEN the same series
    const actual = mapReachToOverviewMetrics(GIVEN_REACH, GIVEN_REQUEST);

    // THEN the sparkline carries each bucket's cumulative count
    expect(actual.dailySeries).toEqual([
      { date: "2026-01", users: 10_000 },
      { date: "2026-02", users: 11_000 },
      { date: "2026-03", users: 12_000 },
    ]);
  });

  it("should compute growth percentage as the change in 'added' between the last two buckets", () => {
    // GIVEN 1 000 added in Feb and 1 200 in Mar — 20 % increase
    const actual = mapReachToOverviewMetrics(GIVEN_REACH, GIVEN_REQUEST);

    expect(actual.cumulativeUsers.growthPercentage).toBe(20);
  });

  it("should mark the last bucket's label as the asOfPeriod", () => {
    const actual = mapReachToOverviewMetrics(GIVEN_REACH, GIVEN_REQUEST);

    expect(actual.cumulativeUsers.asOfPeriod).toBe("2026-03");
  });

  it("should echo the request's dateRange and granularity", () => {
    const actual = mapReachToOverviewMetrics(GIVEN_REACH, GIVEN_REQUEST);

    expect(actual.dateRange).toEqual(GIVEN_REQUEST.dateRange);
    expect(actual.granularity).toBe("month");
  });

  it("should report a portfolio scope when multiple institutions are in scope", () => {
    // GIVEN a request covering three institutions
    const givenRequest: OverviewMetricsRequest = { ...GIVEN_REQUEST, institutions: ["inst-1", "inst-2", "inst-3"] };

    const actual = mapReachToOverviewMetrics(GIVEN_REACH, givenRequest);

    expect(actual.scope).toEqual({ type: "portfolio", institutionCount: 3 });
  });

  it("should report a portfolio scope with count 0 when the grant covers all institutions", () => {
    // GIVEN a request covering the whole deployment
    const givenRequest: OverviewMetricsRequest = { ...GIVEN_REQUEST, institutions: "all" };

    const actual = mapReachToOverviewMetrics(GIVEN_REACH, givenRequest);

    expect(actual.scope).toEqual({ type: "portfolio", institutionCount: 0 });
  });

  it("should return an empty loginMethods array — the reach endpoint does not break down by method", () => {
    const actual = mapReachToOverviewMetrics(GIVEN_REACH, GIVEN_REQUEST);

    expect(actual.loginMethods).toEqual([]);
  });
});

describe("OverviewMetricsService.getOverviewMetrics", () => {
  it("should fetch /api/reach and return a mapped OverviewMetricsResponse", async () => {
    // GIVEN the reach endpoint returns the stub
    server.use(http.get(REACH_API_PATH, () => HttpResponse.json(GIVEN_REACH)));

    // WHEN overview metrics are fetched
    const actual = await service().getOverviewMetrics(GIVEN_REQUEST, "test-token");

    // THEN the response carries the mapped figures
    expect(actual.cumulativeUsers.total).toBe(12_000);
    expect(actual.reachSeries).toHaveLength(3);
  });

  it("should send start_date, end_date, and granularity as query params", async () => {
    // GIVEN the reach endpoint captures the request URL
    let capturedUrl: URL | null = null;
    server.use(
      http.get(REACH_API_PATH, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json(GIVEN_REACH);
      })
    );

    // WHEN the service fetches
    await service().getOverviewMetrics(GIVEN_REQUEST, "test-token");

    // THEN the date and granularity params are present
    expect(capturedUrl!.searchParams.get("start_date")).toBe("2026-01-01");
    expect(capturedUrl!.searchParams.get("end_date")).toBe("2026-03-31");
    expect(capturedUrl!.searchParams.get("granularity")).toBe("month");
  });

  it("should send institution_id when scoped to a single institution", async () => {
    let capturedUrl: URL | null = null;
    server.use(
      http.get(REACH_API_PATH, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json(GIVEN_REACH);
      })
    );

    await service().getOverviewMetrics({ ...GIVEN_REQUEST, institutions: ["inst-1"] }, "test-token");

    expect(capturedUrl!.searchParams.get("institution_id")).toBe("inst-1");
  });

  it("should not send institution_id when scoped to all institutions", async () => {
    let capturedUrl: URL | null = null;
    server.use(
      http.get(REACH_API_PATH, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json(GIVEN_REACH);
      })
    );

    await service().getOverviewMetrics({ ...GIVEN_REQUEST, institutions: "all" }, "test-token");

    expect(capturedUrl!.searchParams.has("institution_id")).toBe(false);
  });

  it("should send the token as a Bearer Authorization header", async () => {
    // GIVEN the reach endpoint captures the request headers
    let capturedAuth: string | null = null;
    server.use(
      http.get(REACH_API_PATH, ({ request }) => {
        capturedAuth = request.headers.get("Authorization");
        return HttpResponse.json(GIVEN_REACH);
      })
    );

    // WHEN the service fetches with a known token
    await service().getOverviewMetrics(GIVEN_REQUEST, "my-token");

    // THEN the token is sent as a bearer credential
    expect(capturedAuth).toBe("Bearer my-token");
  });

  it("should throw an OverviewMetricsApiError carrying the status when the endpoint fails", async () => {
    // GIVEN the reach endpoint is failing
    server.use(http.get(REACH_API_PATH, () => new HttpResponse(null, { status: 500 })));

    // WHEN overview metrics are fetched
    const actualPromise = service().getOverviewMetrics(GIVEN_REQUEST, "test-token");

    // THEN it rejects with the api error and the status
    await expect(actualPromise).rejects.toBeInstanceOf(OverviewMetricsApiError);
    await expect(actualPromise).rejects.toMatchObject({ status: 500 });
  });

  it("should reuse a single instance", () => {
    expect(OverviewMetricsService.getInstance()).toBe(OverviewMetricsService.getInstance());
  });
});
