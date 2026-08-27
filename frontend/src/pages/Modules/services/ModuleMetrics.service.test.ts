import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { MODULE_IDS } from "@/access/AccessContext";
import type { ModuleMetricsRequest, ModuleMetricsResponse } from "@/pages/Modules/types";
import { findModuleMetrics, MODULES_API_BASE, ModuleMetricsService } from "./ModuleMetrics.service";

const GIVEN_REQUEST: ModuleMetricsRequest = {
  institutions: ["inst-1"],
  modules: [MODULE_IDS.BUILD_YOUR_PROFILE, MODULE_IDS.JOB_READINESS, MODULE_IDS.CAREER_EXPLORER, MODULE_IDS.JOBS],
  dateRange: { start: "2025-07-08", end: "2026-07-07" },
};

const GIVEN_BYP_RESPONSE = {
  summary: { started_users: 1_798, started_percentage: 44, completed_users: 502, avg_completion_minutes: 12 },
  series: [],
  phases: [
    { id: "intro", reached: 1_798 },
    { id: "experiences", reached: 1_546 },
    { id: "skills", reached: 1_150 },
    { id: "completed", reached: 502 },
  ],
  degraded: false,
};

function service(): ModuleMetricsService {
  return ModuleMetricsService.getInstance();
}

describe("ModuleMetricsService.getModuleMetrics", () => {
  it("should return one entry per requested module, in request order", async () => {
    // GIVEN the BYP endpoint responds normally
    server.use(http.get(`${MODULES_API_BASE}/build-your-profile`, () => HttpResponse.json(GIVEN_BYP_RESPONSE)));

    // WHEN metrics are fetched for the whole suite
    const actual = await service().getModuleMetrics(GIVEN_REQUEST, "test-token");

    // THEN each requested module has an entry, in the same order
    expect(actual.modules.map((m) => m.moduleId)).toEqual([
      "build-your-profile",
      "job-readiness",
      "career-explorer",
      "jobs",
    ]);
  });

  it("should echo back the request date range", async () => {
    // GIVEN the BYP endpoint responds
    server.use(http.get(`${MODULES_API_BASE}/build-your-profile`, () => HttpResponse.json(GIVEN_BYP_RESPONSE)));

    // WHEN metrics are fetched
    const actual = await service().getModuleMetrics(GIVEN_REQUEST, "test-token");

    // THEN the date range is echoed back so a stale response can be identified
    expect(actual.dateRange).toEqual(GIVEN_REQUEST.dateRange);
  });

  it("should map BYP summary figures from the backend response", async () => {
    // GIVEN the BYP endpoint returns known figures
    server.use(http.get(`${MODULES_API_BASE}/build-your-profile`, () => HttpResponse.json(GIVEN_BYP_RESPONSE)));

    // WHEN metrics are fetched
    const actual = await service().getModuleMetrics(GIVEN_REQUEST, "test-token");
    const byp = actual.modules.find((m) => m.moduleId === "build-your-profile");

    // THEN the BYP figures are mapped from the real response
    expect(byp).toBeDefined();
    expect(byp?.startedPercentage).toBe(44);
  });

  it("should return a degraded stub for BYP when the backend fails", async () => {
    // GIVEN the BYP endpoint is failing
    server.use(http.get(`${MODULES_API_BASE}/build-your-profile`, () => new HttpResponse(null, { status: 503 })));

    // WHEN metrics are fetched — it should NOT throw
    const actual = await service().getModuleMetrics(GIVEN_REQUEST, "test-token");
    const byp = actual.modules.find((m) => m.moduleId === "build-your-profile");

    // THEN BYP returns a degraded stub rather than failing the whole page
    expect(byp).toBeDefined();
    expect((byp as { degraded?: boolean }).degraded).toBe(true);
  });

  it("should map Job Readiness figures from the backend response", async () => {
    // GIVEN the JR endpoint returns known figures
    server.use(http.get(`${MODULES_API_BASE}/build-your-profile`, () => HttpResponse.json(GIVEN_BYP_RESPONSE)));

    // WHEN metrics are fetched
    const actual = await service().getModuleMetrics(GIVEN_REQUEST, "test-token");
    const jr = actual.modules.find((m) => m.moduleId === "job-readiness");

    // THEN JR figures are mapped from the real response (stub handler returns 34%)
    expect(jr?.startedPercentage).toBe(34);
  });

  it("should return degraded stubs for modules with no backend endpoint yet", async () => {
    // GIVEN BYP and JR endpoints respond; CE and Jobs have no endpoint
    server.use(http.get(`${MODULES_API_BASE}/build-your-profile`, () => HttpResponse.json(GIVEN_BYP_RESPONSE)));

    // WHEN metrics are fetched
    const actual = await service().getModuleMetrics(GIVEN_REQUEST, "test-token");

    // THEN unimplemented modules come back as empty, zero-value stubs
    const ce = actual.modules.find((m) => m.moduleId === "career-explorer");
    const jobs = actual.modules.find((m) => m.moduleId === "jobs");

    expect(ce?.startedPercentage).toBe(0);
    expect(jobs?.startedPercentage).toBe(0);
  });

  it("should return only the modules a deployment actually runs", async () => {
    // GIVEN a deployment running BYP only
    const givenOneModule: ModuleMetricsRequest = { ...GIVEN_REQUEST, modules: [MODULE_IDS.BUILD_YOUR_PROFILE] };
    server.use(http.get(`${MODULES_API_BASE}/build-your-profile`, () => HttpResponse.json(GIVEN_BYP_RESPONSE)));

    // WHEN metrics are fetched
    const actual = await service().getModuleMetrics(givenOneModule, "test-token");

    // THEN only one module entry comes back
    expect(actual.modules).toHaveLength(1);
    expect(actual.modules[0].moduleId).toBe("build-your-profile");
  });

  it("should send the bearer token to the BYP endpoint", async () => {
    // GIVEN the BYP endpoint captures the auth header
    let capturedAuth: string | null = null;
    server.use(
      http.get(`${MODULES_API_BASE}/build-your-profile`, ({ request }) => {
        capturedAuth = request.headers.get("Authorization");
        return HttpResponse.json(GIVEN_BYP_RESPONSE);
      })
    );

    // WHEN metrics are fetched with a known token
    await service().getModuleMetrics({ ...GIVEN_REQUEST, modules: [MODULE_IDS.BUILD_YOUR_PROFILE] }, "my-token");

    // THEN the token is forwarded as a bearer credential
    expect(capturedAuth).toBe("Bearer my-token");
  });

  it("should scope BYP to a single institution when one is in scope", async () => {
    // GIVEN the BYP endpoint captures the request URL
    let capturedUrl: URL | null = null;
    server.use(
      http.get(`${MODULES_API_BASE}/build-your-profile`, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json(GIVEN_BYP_RESPONSE);
      })
    );

    // WHEN metrics are fetched scoped to one institution
    await service().getModuleMetrics(
      { ...GIVEN_REQUEST, modules: [MODULE_IDS.BUILD_YOUR_PROFILE], institutions: ["inst-1"] },
      "test-token"
    );

    // THEN the institution_id is forwarded
    expect(capturedUrl!.searchParams.get("institution_id")).toBe("inst-1");
  });

  it("should reuse the same instance", () => {
    expect(ModuleMetricsService.getInstance()).toBe(ModuleMetricsService.getInstance());
  });
});

describe("findModuleMetrics", () => {
  const GIVEN_RESPONSE = {
    scope: { type: "portfolio", institutionCount: 5 },
    dateRange: GIVEN_REQUEST.dateRange,
    modules: [
      { moduleId: MODULE_IDS.JOBS, startedPercentage: 26 },
      { moduleId: MODULE_IDS.CAREER_EXPLORER, startedPercentage: 18 },
    ],
  } as unknown as ModuleMetricsResponse;

  it("should single out the module that was asked for", () => {
    // GIVEN a response covering Jobs and Career Explorer
    // WHEN Career Explorer is singled out
    const actual = findModuleMetrics(GIVEN_RESPONSE, MODULE_IDS.CAREER_EXPLORER);

    // THEN its own figures come back
    expect(actual?.moduleId).toBe("career-explorer");
  });

  it("should return nothing for a module the response doesn't cover", () => {
    // GIVEN a response that doesn't cover BYP
    // WHEN BYP is singled out
    const actual = findModuleMetrics(GIVEN_RESPONSE, MODULE_IDS.BUILD_YOUR_PROFILE);

    // THEN nothing comes back rather than another module's figures
    expect(actual).toBeNull();
  });
});
