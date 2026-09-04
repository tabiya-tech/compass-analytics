import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { JobseekersApiError, JobseekersService } from "@/jobseekers/services/Jobseekers.service";
import type { JobseekerDetail, JobseekersQuery, JobseekersResponse } from "@/jobseekers/jobseekers.types";

const givenToken = "some-id-token";

const givenQuery: JobseekersQuery = {
  scope: { institutionIds: ["inst-1", "inst-2"] },
  search: "maría",
  module_status: { "build-your-profile": ["completed"], "job-readiness": ["not_started", "in_progress"] },
  sort: { by: "profile_score_pct", direction: "desc" },
  page: 2,
  page_size: 25,
};

const givenJobseeker: JobseekersResponse["items"][number] = {
  id: "JS-10230",
  name: "María González",
  institution_id: "inst-1",
  institution_name: "Mazabuka Livelihoods Trust",
  profile_score_pct: 100,
  registered_at: "2026-02-05",
  last_login_at: "2026-07-04",
  module_status: { "build-your-profile": "completed" },
  skills_report_ready: true,
  skills: ["Customer service"],
};

const givenResponse: JobseekersResponse = { items: [givenJobseeker], total: 1, page: 2, page_size: 25 };

const givenDetail: JobseekerDetail = {
  id: "JS-10230",
  name: "María González",
  institution_id: "inst-1",
  institution_name: "Mazabuka Livelihoods Trust",
  profile_score_pct: 100,
  demographics: { gender: "Female", age: 18, location: "Mazabuka", education: "Secondary" },
  login_activity: {
    registered_at: "2026-02-05",
    last_login_at: "2026-07-04",
    total_logins: 1,
    login_method: "google",
  },
  modules: [{ module_id: "build-your-profile", status: "completed", phase: "Completed" }],
  outputs: { skills_report_generated: true, downloaded: false, shared: false },
  skills: ["Customer service"],
};

describe("JobseekersService", () => {
  it("should ask the endpoint for the searched, filtered, sorted and paged slice of the roster", async () => {
    // GIVEN a jobseekers endpoint that records how it was called
    let actualUrl: URL | undefined;
    server.use(
      http.get("/api/jobseekers", ({ request }) => {
        actualUrl = new URL(request.url);
        return HttpResponse.json(givenResponse);
      })
    );

    // WHEN the roster is fetched for the given query
    await JobseekersService.getInstance().getJobseekers(givenQuery, givenToken);

    // THEN the search, sort and pagination travel as query parameters
    expect(actualUrl?.pathname).toBe("/api/jobseekers");
    expect(actualUrl?.searchParams.get("search")).toBe("maría");
    expect(actualUrl?.searchParams.get("sort_by")).toBe("profile_score_pct");
    expect(actualUrl?.searchParams.get("sort_dir")).toBe("desc");
    expect(actualUrl?.searchParams.get("page")).toBe("2");
    expect(actualUrl?.searchParams.get("page_size")).toBe("25");
    // AND each kept module status travels as its own module-qualified parameter
    expect(actualUrl?.searchParams.getAll("module_status")).toEqual([
      "build-your-profile:completed",
      "job-readiness:not_started",
      "job-readiness:in_progress",
    ]);
  });

  it("should name every institution the caller's grant covers, so the endpoint can scope the roster", async () => {
    // GIVEN a jobseekers endpoint that records how it was called
    let actualUrl: URL | undefined;
    server.use(
      http.get("/api/jobseekers", ({ request }) => {
        actualUrl = new URL(request.url);
        return HttpResponse.json(givenResponse);
      })
    );

    // WHEN the roster is fetched for a grant covering two institutions
    await JobseekersService.getInstance().getJobseekers(givenQuery, givenToken);

    // THEN each institution travels as its own repeated parameter
    expect(actualUrl?.searchParams.getAll("institution_id")).toEqual(["inst-1", "inst-2"]);
    expect(actualUrl?.searchParams.get("scope")).toBeNull();
  });

  it("should ask the endpoint to resolve the grant itself when it covers every institution", async () => {
    // GIVEN a jobseekers endpoint that records how it was called
    let actualUrl: URL | undefined;
    server.use(
      http.get("/api/jobseekers", ({ request }) => {
        actualUrl = new URL(request.url);
        return HttpResponse.json(givenResponse);
      })
    );

    // WHEN the roster is fetched for a deployment-wide grant
    await JobseekersService.getInstance().getJobseekers({ ...givenQuery, scope: { institutionIds: null } }, givenToken);

    // THEN no institution is named, and the scope says so outright
    expect(actualUrl?.searchParams.get("scope")).toBe("all");
    expect(actualUrl?.searchParams.getAll("institution_id")).toEqual([]);
  });

  it("should send the caller's token as a bearer token", async () => {
    // GIVEN a jobseekers endpoint that records the authorization header
    let actualAuthorization: string | null = null;
    server.use(
      http.get("/api/jobseekers", ({ request }) => {
        actualAuthorization = request.headers.get("Authorization");
        return HttpResponse.json(givenResponse);
      })
    );

    // WHEN the roster is fetched
    await JobseekersService.getInstance().getJobseekers(givenQuery, givenToken);

    // THEN the token is presented as a bearer token
    expect(actualAuthorization).toBe(`Bearer ${givenToken}`);
  });

  it("should return the roster the endpoint served", async () => {
    // GIVEN a jobseekers endpoint serving one jobseeker
    server.use(http.get("/api/jobseekers", () => HttpResponse.json(givenResponse)));

    // WHEN the roster is fetched
    const actualResponse = await JobseekersService.getInstance().getJobseekers(givenQuery, givenToken);

    // THEN the response comes back as served
    expect(actualResponse).toEqual(givenResponse);
  });

  it("should fetch one jobseeker's profile by their id", async () => {
    // GIVEN a profile endpoint that records which jobseeker was asked for
    let actualPathname: string | undefined;
    server.use(
      http.get("/api/jobseekers/:jobseekerId", ({ request }) => {
        actualPathname = new URL(request.url).pathname;
        return HttpResponse.json(givenDetail);
      })
    );

    // WHEN that jobseeker's profile is fetched
    const actualDetail = await JobseekersService.getInstance().getJobseeker("JS-10230", givenToken);

    // THEN the id is part of the path, and the profile comes back as served
    expect(actualPathname).toBe("/api/jobseekers/JS-10230");
    expect(actualDetail).toEqual(givenDetail);
  });

  it("should report the status when the endpoint refuses the roster", async () => {
    // GIVEN a jobseekers endpoint that refuses the caller
    const givenStatus = 403;
    server.use(http.get("/api/jobseekers", () => new HttpResponse(null, { status: givenStatus })));

    // WHEN the roster is fetched
    const actualCall = JobseekersService.getInstance().getJobseekers(givenQuery, givenToken);

    // THEN the refusal surfaces as an API error carrying the status
    await expect(actualCall).rejects.toThrow(JobseekersApiError);
    await expect(actualCall).rejects.toMatchObject({ status: givenStatus });
  });
});
