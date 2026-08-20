import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { MODULE_IDS } from "@/access/AccessContext";
import type { ModuleMetricsRequest, ModuleMetricsResponse } from "@/pages/Modules/types";
import {
  buildModuleMetricsQuery,
  findModuleMetrics,
  MODULES_API_BASE,
  ModuleMetricsApiError,
  ModuleMetricsService,
} from "./ModuleMetrics.service";

const GIVEN_WHOLE_SUITE: ModuleMetricsRequest = {
  institutions: ["inst-1"],
  modules: [MODULE_IDS.BUILD_YOUR_PROFILE, MODULE_IDS.JOB_READINESS, MODULE_IDS.CAREER_EXPLORER, MODULE_IDS.JOBS],
  dateRange: { start: "2025-07-08", end: "2026-07-07" },
};

function service(): ModuleMetricsService {
  return ModuleMetricsService.getInstance();
}

describe("buildModuleMetricsQuery", () => {
  it("should send the scope and the range, and nothing for the unset filters", () => {
    // GIVEN a request with no chip filters applied
    // WHEN the query is built
    const actualQuery = buildModuleMetricsQuery(GIVEN_WHOLE_SUITE);

    // THEN the scope and the range are sent
    expect(actualQuery.get("institutions")).toBe("inst-1");
    expect(actualQuery.get("start")).toBe("2025-07-08");
    expect(actualQuery.get("end")).toBe("2026-07-07");
    // AND the filters are absent rather than empty
    expect(actualQuery.has("audienceSegment")).toBe(false);
    expect(actualQuery.has("loginMethod")).toBe(false);
  });

  it("should name every module the deployment runs, in the order it runs them", () => {
    // GIVEN a deployment running two of the four modules, Jobs first
    const givenTwoModules: ModuleMetricsRequest = {
      ...GIVEN_WHOLE_SUITE,
      modules: [MODULE_IDS.JOBS, MODULE_IDS.BUILD_YOUR_PROFILE],
    };

    // WHEN the query is built
    const actualQuery = buildModuleMetricsQuery(givenTwoModules);

    // THEN both are asked for, keeping that order
    expect(actualQuery.getAll("modules")).toEqual(["jobs", "build-your-profile"]);
  });

  it("should send the applied filters, so the figures cover the same slice as the rest of the dashboard", () => {
    // GIVEN a request filtered to young jobseekers who signed in with Google
    const givenFilteredRequest: ModuleMetricsRequest = {
      ...GIVEN_WHOLE_SUITE,
      audienceSegment: "youth",
      loginMethod: "google",
    };

    // WHEN the query is built
    const actualQuery = buildModuleMetricsQuery(givenFilteredRequest);

    // THEN both filters are sent
    expect(actualQuery.get("audienceSegment")).toBe("youth");
    expect(actualQuery.get("loginMethod")).toBe("google");
  });

  it("should ask for the whole deployment as a single scope value", () => {
    // GIVEN a grant covering every institution
    // WHEN the query is built
    const actualQuery = buildModuleMetricsQuery({ ...GIVEN_WHOLE_SUITE, institutions: "all" });

    // THEN the scope is sent as one value rather than a list of ids
    expect(actualQuery.get("institutions")).toBe("all");
  });
});

describe("ModuleMetricsService", () => {
  it("should return a body for every module that was asked for", async () => {
    // GIVEN a deployment running the whole suite
    // WHEN its metrics are fetched
    const actualMetrics = await service().getModuleMetrics(GIVEN_WHOLE_SUITE);

    // THEN one set of figures comes back per module
    expect(actualMetrics.modules.map((module) => module.moduleId)).toEqual([
      "build-your-profile",
      "job-readiness",
      "career-explorer",
      "jobs",
    ]);
    // AND the window is echoed back, so a stale response can be told apart from the current one
    expect(actualMetrics.dateRange).toEqual(GIVEN_WHOLE_SUITE.dateRange);
  });

  it("should return only the modules a deployment actually runs", async () => {
    // GIVEN a deployment running Build Your Profile alone
    const givenOneModule: ModuleMetricsRequest = { ...GIVEN_WHOLE_SUITE, modules: [MODULE_IDS.BUILD_YOUR_PROFILE] };

    // WHEN its metrics are fetched
    const actualMetrics = await service().getModuleMetrics(givenOneModule);

    // THEN nothing is reported for the modules it doesn't run
    expect(actualMetrics.modules).toHaveLength(1);
    expect(actualMetrics.modules[0].moduleId).toBe("build-your-profile");
  });

  it("should raise a failure carrying the status, so the screen can offer a retry", async () => {
    // GIVEN the endpoint is failing
    server.use(http.get(`${MODULES_API_BASE}/metrics`, () => new HttpResponse(null, { status: 503 })));

    // WHEN the metrics are fetched
    const actualCall = service().getModuleMetrics(GIVEN_WHOLE_SUITE);

    // THEN the failure names the status it failed with
    await expect(actualCall).rejects.toBeInstanceOf(ModuleMetricsApiError);
    await expect(actualCall).rejects.toMatchObject({ status: 503 });
  });
});

describe("findModuleMetrics", () => {
  const GIVEN_RESPONSE = {
    scope: { type: "portfolio", institutionCount: 5 },
    dateRange: GIVEN_WHOLE_SUITE.dateRange,
    modules: [
      { moduleId: MODULE_IDS.JOBS, startedPercentage: 26 },
      { moduleId: MODULE_IDS.CAREER_EXPLORER, startedPercentage: 18 },
    ],
  } as unknown as ModuleMetricsResponse;

  it("should single out the module that was asked for", () => {
    // GIVEN a response covering Jobs and Career Explorer
    // WHEN Career Explorer is singled out
    const actualModule = findModuleMetrics(GIVEN_RESPONSE, MODULE_IDS.CAREER_EXPLORER);

    // THEN its own figures come back
    expect(actualModule?.moduleId).toBe("career-explorer");
  });

  it("should return nothing for a module the response doesn't cover", () => {
    // GIVEN a response that doesn't cover Build Your Profile
    // WHEN Build Your Profile is singled out
    const actualModule = findModuleMetrics(GIVEN_RESPONSE, MODULE_IDS.BUILD_YOUR_PROFILE);

    // THEN nothing comes back, rather than another module's figures
    expect(actualModule).toBeNull();
  });
});
