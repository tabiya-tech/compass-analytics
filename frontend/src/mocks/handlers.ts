import { http, HttpResponse, type HttpHandler } from "msw";
import type {
  BuildYourProfileResponse,
  DemographicsResponse,
  JobReadinessResponse,
  ReachResponse,
} from "@/analytics/analytics.types";
import type { MeResponse } from "@/user/user.types";
import { buildOverviewMetrics, parseOverviewMetricsQuery } from "@/mocks/overview-metrics";
import { buildModuleMetrics, parseModuleMetricsQuery } from "@/mocks/module-metrics";
import { OVERVIEW_API_BASE } from "@/pages/Overview/services/OverviewMetrics.service";
import { MODULES_API_BASE } from "@/pages/Modules/services/ModuleMetrics.service";
import type { InstitutionSortKey, SortDirection } from "@/institutions/institutions.types";
import { findInstitutionDetail, queryInstitutions } from "@/mocks/data/institutions";
import type { ModuleId } from "@/access/AccessContext";
import type { JobseekerSortKey, ModuleStatus, ModuleStatusFilters } from "@/jobseekers/jobseekers.types";
import { findJobseekerDetail, queryJobseekers } from "@/mocks/data/jobseekers";

const stubReach: ReachResponse = {
  summary: {
    total_users: 12_450,
    active_users_30d: 3_210,
    total_logins: 48_900,
    avg_logins_per_user: 3.93,
    avg_session_minutes: 22,
  },
  series: [
    { label: "Jan", cumulative: 8_000, added: 900, new_users: 900, returning: 7_100, logins: 6_200 },
    { label: "Feb", cumulative: 9_200, added: 1_200, new_users: 1_200, returning: 8_000, logins: 7_100 },
    { label: "Mar", cumulative: 10_400, added: 1_100, new_users: 1_100, returning: 9_300, logins: 8_400 },
    { label: "Apr", cumulative: 11_100, added: 700, new_users: 700, returning: 10_400, logins: 9_100 },
    { label: "May", cumulative: 11_800, added: 700, new_users: 700, returning: 11_100, logins: 9_800 },
    { label: "Jun", cumulative: 12_450, added: 650, new_users: 650, returning: 11_800, logins: 10_400 },
  ],
};

const stubBuildYourProfile: BuildYourProfileResponse = {
  summary: {
    started_users: 1_798,
    started_percentage: 44,
    completed_users: 502,
    avg_completion_minutes: 12,
  },
  series: [],
  phases: [
    { id: "intro", reached: 1_798 },
    { id: "experiences", reached: 1_546 },
    { id: "skills", reached: 1_150 },
    { id: "completed", reached: 502 },
  ],
  degraded: false,
};

const stubDemographics: DemographicsResponse = {
  charts: [
    {
      type: "pie-chart",
      name: "gender",
      items: [
        { name: "female", value: 6_190 },
        { name: "male", value: 5_820 },
        { name: "other", value: 440 },
      ],
    },
    {
      type: "horizontal-bar-chart",
      name: "region",
      items: [
        { name: "Lusaka", value: 4_190 },
        { name: "Copperbelt", value: 3_040 },
        { name: "Southern", value: 2_350 },
        { name: "Eastern", value: 1_640 },
        { name: "Central", value: 1_230 },
      ],
    },
  ],
  degraded: false,
};

const stubMe: MeResponse = {
  user_id: "dev-funder",
  email: "funder@example.com",
  name: "Dev Funder",
  permissions: ["dashboard:view", "institutions:view", "account:view"],
  scope: { type: "all", institution_ids: [] },
  active_modules: ["build-your-profile", "job-readiness", "career-explorer", "jobs"],
};

/** Applies the query server-side, the way the real endpoint will: search, filter, sort, paginate. */
export const institutionsHandler = http.get("/api/institutions", ({ request }) => {
  const params = new URL(request.url).searchParams;
  return HttpResponse.json(
    queryInstitutions({
      search: params.get("search") ?? undefined,
      regions: params.getAll("region"),
      sort: {
        by: (params.get("sort_by") as InstitutionSortKey | null) ?? "registered_users",
        direction: (params.get("sort_dir") as SortDirection | null) ?? "desc",
      },
      page: Number(params.get("page") ?? 1),
      page_size: Number(params.get("page_size") ?? 30),
    })
  );
});

/** The drill-down behind a table row. */
export const institutionDetailHandler = http.get("/api/institutions/:institutionId", ({ params }) => {
  const detail = findInstitutionDetail(String(params.institutionId));
  return detail ? HttpResponse.json(detail) : new HttpResponse(null, { status: 404 });
});

/** `module_status=build-your-profile:completed` repeated — regrouped into one entry per module. */
function parseModuleStatusFilters(values: string[]): ModuleStatusFilters {
  const filters: ModuleStatusFilters = {};
  for (const value of values) {
    const [moduleId, status] = value.split(":") as [ModuleId, ModuleStatus];
    if (!moduleId || !status) continue;
    filters[moduleId] = [...(filters[moduleId] ?? []), status];
  }
  return filters;
}

/**
 * The roster, scoped to the institutions the caller's grant covers. The real endpoint reads that
 * grant off the bearer token; here the request carries it, which is enough to exercise the screen
 * but is deliberately NOT the shape of the real guarantee — see Jobseekers.service.ts.
 */
export const jobseekersHandler = http.get("/api/jobseekers", ({ request }) => {
  const params = new URL(request.url).searchParams;
  const institutionIds = params.getAll("institution_id");
  return HttpResponse.json(
    queryJobseekers({
      scope: params.get("scope") === "all" ? { type: "all" } : { type: "institutions", institutionIds },
      search: params.get("search") ?? undefined,
      module_status: parseModuleStatusFilters(params.getAll("module_status")),
      sort: {
        by: (params.get("sort_by") as JobseekerSortKey | null) ?? "name",
        direction: (params.get("sort_dir") as SortDirection | null) ?? "asc",
      },
      page: Number(params.get("page") ?? 1),
      page_size: Number(params.get("page_size") ?? 50),
    })
  );
});

/** The profile drill-down behind a roster row. */
export const jobseekerDetailHandler = http.get("/api/jobseekers/:jobseekerId", ({ params }) => {
  const detail = findJobseekerDetail(String(params.jobseekerId));
  return detail ? HttpResponse.json(detail) : new HttpResponse(null, { status: 404 });
});

/** Stands in for the not-yet-built metrics endpoint — exported individually so the browser dev worker can include it too. */
export const overviewMetricsHandler = http.get(`${OVERVIEW_API_BASE}/metrics`, ({ request }) => {
  const query = new URL(request.url).searchParams;
  return HttpResponse.json(buildOverviewMetrics(parseOverviewMetricsQuery(query)));
});

/** Per-module figures for every module the caller asked for — the Modules screen compares them, so they come back together. */
export const moduleMetricsHandler = http.get(`${MODULES_API_BASE}/metrics`, ({ request }) => {
  const query = new URL(request.url).searchParams;
  return HttpResponse.json(buildModuleMetrics(parseModuleMetricsQuery(query)));
});

const stubJobReadiness: JobReadinessResponse = {
  started_percentage: 34.0,
  sub_modules: [
    { id: "cv-builder", name: "CV Builder", started: 1_200, completed: 663 },
    { id: "interview-prep", name: "Interview Prep", started: 1_500, completed: 981 },
    { id: "workplace-skills", name: "Workplace Skills", started: 1_080, completed: 729 },
    { id: "digital-basics", name: "Digital Basics", started: 897, completed: 441 },
  ],
  degraded: false,
};

/** Job Readiness module analytics — exported individually so the browser dev worker can include it too. */
export const jobReadinessHandler = http.get("/api/modules/job-readiness", () => HttpResponse.json(stubJobReadiness));

/** Stands in for the real /api/me — exported individually so the browser dev worker can include it too. */
export const meHandler = http.get("/api/me", () => HttpResponse.json(stubMe));

/** Not in the dev worker, like /api/reach — exported individually so overriding stories can still include it. */
export const buildYourProfileHandler = http.get(`${MODULES_API_BASE}/build-your-profile`, () =>
  HttpResponse.json(stubBuildYourProfile)
);

/** Not in the dev worker, like /api/reach — exported individually so overriding stories can still include it. */
export const demographicsHandler = http.get("/api/demographics", () => HttpResponse.json(stubDemographics));

/** Full handler list for tests and Storybook, so components render with realistic data without the backend running. */
export const handlers: HttpHandler[] = [
  overviewMetricsHandler,
  moduleMetricsHandler,
  jobReadinessHandler,
  institutionsHandler,
  institutionDetailHandler,
  meHandler,
  http.post("/api/users/register", () => new HttpResponse(null, { status: 201 })),
  http.get("/api/reach", () => HttpResponse.json(stubReach)),
  buildYourProfileHandler,
  demographicsHandler,
  jobseekersHandler,
  jobseekerDetailHandler,
];
