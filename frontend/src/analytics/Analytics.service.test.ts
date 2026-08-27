import { describe, expect, it } from "vitest";
import { http, HttpResponse, type JsonBodyType } from "msw";
import { server } from "@/mocks/server";
import { AnalyticsApiError, AnalyticsService } from "@/analytics/Analytics.service";
import type {
  AnalyticsParams,
  BuildYourProfileResponse,
  CareerExplorerResponse,
  ReachResponse,
} from "@/analytics/analytics.types";

const givenToken = "some-id-token";

const givenParams: AnalyticsParams = {
  start_date: "2026-01-01",
  end_date: "2026-06-30",
  granularity: "week",
  audience_segment: "youth",
  login_method: "email",
  institution_id: "inst-1",
};

const givenReach: ReachResponse = {
  summary: {
    total_users: 5000,
    active_users_30d: 1200,
    total_logins: 20000,
    avg_logins_per_user: 4,
    avg_session_minutes: 18,
  },
  series: [{ label: "Jan", cumulative: 5000, added: 500, new_users: 400, returning: 100, logins: 800 }],
};

const givenBuildYourProfile: BuildYourProfileResponse = {
  summary: { started_users: 1200, started_percentage: 44, completed_users: 500, avg_completion_minutes: 12 },
  series: [{ label: "Jan", started: 120, completed: 40, skills_reports_generated: 38, skills_reports_downloaded: 21 }],
  phases: [{ id: "intro", reached: 1200 }],
  degraded: false,
};

const givenCareerExplorer: CareerExplorerResponse = {
  summary: {
    total_registered_students: 12_450,
    started_users: 2_241,
    started_percentage: 18,
    returned_users: 890,
    returned_percentage: 39.7,
    priority_sector_users: 640,
    non_priority_sector_users: 1_601,
  },
  top_sectors: [{ sector_name: "Healthcare", is_priority: true, unique_users: 188, total_inquiries: 421 }],
  degraded: false,
};

/** Records how an endpoint was called, so a test can assert on the URL the service built. */
function captureUrl(path: string, body: JsonBodyType): () => URL {
  let actualUrl: URL | undefined;
  server.use(
    http.get(path, ({ request }) => {
      actualUrl = new URL(request.url);
      return HttpResponse.json(body);
    })
  );
  return () => actualUrl as URL;
}

describe("AnalyticsService", () => {
  it("should send every filter it was given to the reach endpoint", async () => {
    // GIVEN a reach endpoint that records how it was called
    const actualUrlOf = captureUrl("/api/reach", givenReach);

    // WHEN reach is fetched with the full filter set
    await AnalyticsService.getInstance().getReach(givenParams, givenToken);

    // THEN each filter travels as its own query parameter, unchanged
    const actualUrl = actualUrlOf();
    expect(actualUrl.pathname).toBe("/api/reach");
    expect(actualUrl.searchParams.get("start_date")).toBe("2026-01-01");
    expect(actualUrl.searchParams.get("end_date")).toBe("2026-06-30");
    expect(actualUrl.searchParams.get("granularity")).toBe("week");
    expect(actualUrl.searchParams.get("audience_segment")).toBe("youth");
    expect(actualUrl.searchParams.get("login_method")).toBe("email");
    expect(actualUrl.searchParams.get("institution_id")).toBe("inst-1");
  });

  it("should send no value for an omitted optional filter", async () => {
    // GIVEN a filter set with only the required filters
    const given: AnalyticsParams = { start_date: "2026-01-01", end_date: "2026-06-30", granularity: "month" };
    const actualUrlOf = captureUrl("/api/reach", givenReach);

    // WHEN reach is fetched
    await AnalyticsService.getInstance().getReach(given, givenToken);

    // THEN the optional filters are absent from the query string rather than sent empty
    const actualUrl = actualUrlOf();
    expect(actualUrl.searchParams.has("audience_segment")).toBe(false);
    expect(actualUrl.searchParams.has("login_method")).toBe(false);
    expect(actualUrl.searchParams.has("institution_id")).toBe(false);
  });

  it("should send the caller's token as a bearer credential", async () => {
    // GIVEN a reach endpoint that records the Authorization header
    let actualAuthorization: string | null = null;
    server.use(
      http.get("/api/reach", ({ request }) => {
        actualAuthorization = request.headers.get("Authorization");
        return HttpResponse.json(givenReach);
      })
    );

    // WHEN reach is fetched
    await AnalyticsService.getInstance().getReach(givenParams, givenToken);

    // THEN the token travels as a bearer credential
    expect(actualAuthorization).toBe(`Bearer ${givenToken}`);
  });

  it("should return the reach payload the endpoint answered with", async () => {
    // GIVEN a reach endpoint answering with a payload
    server.use(http.get("/api/reach", () => HttpResponse.json(givenReach)));

    // WHEN reach is fetched
    const actual = await AnalyticsService.getInstance().getReach(givenParams, givenToken);

    // THEN the payload is returned as-is
    expect(actual).toEqual(givenReach);
  });

  it("should send the same filter set to the Build Your Profile endpoint", async () => {
    // GIVEN the module endpoint recording how it was called
    const actualUrlOf = captureUrl("/api/modules/build-your-profile", givenBuildYourProfile);

    // WHEN Build Your Profile is fetched with the full filter set
    await AnalyticsService.getInstance().getBuildYourProfile(givenParams, givenToken);

    // THEN it is called on its own path, carrying the same filters reach takes
    const actualUrl = actualUrlOf();
    expect(actualUrl.pathname).toBe("/api/modules/build-your-profile");
    expect(actualUrl.searchParams.get("start_date")).toBe("2026-01-01");
    expect(actualUrl.searchParams.get("end_date")).toBe("2026-06-30");
    expect(actualUrl.searchParams.get("granularity")).toBe("week");
    expect(actualUrl.searchParams.get("audience_segment")).toBe("youth");
    expect(actualUrl.searchParams.get("login_method")).toBe("email");
    expect(actualUrl.searchParams.get("institution_id")).toBe("inst-1");
  });

  it("should return the Build Your Profile payload the endpoint answered with", async () => {
    // GIVEN the module endpoint answering with a payload
    server.use(http.get("/api/modules/build-your-profile", () => HttpResponse.json(givenBuildYourProfile)));

    // WHEN Build Your Profile is fetched
    const actual = await AnalyticsService.getInstance().getBuildYourProfile(givenParams, givenToken);

    // THEN the payload is returned as-is
    expect(actual).toEqual(givenBuildYourProfile);
  });

  it("should send the same filter set to the Career Explorer endpoint", async () => {
    // GIVEN the module endpoint recording how it was called
    const actualUrlOf = captureUrl("/api/modules/career-explorer", givenCareerExplorer);

    // WHEN Career Explorer is fetched with the full filter set
    await AnalyticsService.getInstance().getCareerExplorer(givenParams, givenToken);

    // THEN it is called on its own path, carrying the same filters reach takes
    const actualUrl = actualUrlOf();
    expect(actualUrl.pathname).toBe("/api/modules/career-explorer");
    expect(actualUrl.searchParams.get("start_date")).toBe("2026-01-01");
    expect(actualUrl.searchParams.get("end_date")).toBe("2026-06-30");
    expect(actualUrl.searchParams.get("granularity")).toBe("week");
    expect(actualUrl.searchParams.get("audience_segment")).toBe("youth");
    expect(actualUrl.searchParams.get("login_method")).toBe("email");
    expect(actualUrl.searchParams.get("institution_id")).toBe("inst-1");
  });

  it("should return the Career Explorer payload the endpoint answered with", async () => {
    // GIVEN the module endpoint answering with a payload
    server.use(http.get("/api/modules/career-explorer", () => HttpResponse.json(givenCareerExplorer)));

    // WHEN Career Explorer is fetched
    const actual = await AnalyticsService.getInstance().getCareerExplorer(givenParams, givenToken);

    // THEN the payload is returned as-is
    expect(actual).toEqual(givenCareerExplorer);
  });

  it("should raise a typed error carrying the status when the endpoint rejects the filters", async () => {
    // GIVEN a reach endpoint that rejects the filters as invalid
    server.use(http.get("/api/reach", () => new HttpResponse(null, { status: 422 })));

    // WHEN reach is fetched
    const actual = AnalyticsService.getInstance().getReach(givenParams, givenToken);

    // THEN the failure surfaces as an AnalyticsApiError carrying the status
    await expect(actual).rejects.toBeInstanceOf(AnalyticsApiError);
    await expect(actual).rejects.toMatchObject({ status: 422 });
  });
});
