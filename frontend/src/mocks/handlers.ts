import { http, HttpResponse, type HttpHandler } from "msw";
import type {
  BuildYourProfileResponse,
  CareerExplorerResponse,
  DemographicsResponse,
  JobReadinessResponse,
  JobsResponse,
  ReachResponse,
} from "@/analytics/analytics.types";
import type { ManagedUser, MeResponse, RoleRecord } from "@/user/user.types";
import { REACH_API_PATH } from "@/pages/Overview/services/OverviewMetrics.service";
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

const stubCareerExplorer: CareerExplorerResponse = {
  summary: {
    total_registered_students: 12_450,
    started_users: 2_241,
    started_percentage: 18,
    returned_users: 890,
    returned_percentage: 39.7,
    priority_sector_users: 640,
    non_priority_sector_users: 1_601,
  },
  // Ranked by total inquiries, the way the real endpoint ranks them.
  top_sectors: [
    { sector_name: "Healthcare", is_priority: true, unique_users: 188, total_inquiries: 421 },
    { sector_name: "Technology", is_priority: false, unique_users: 152, total_inquiries: 310 },
    { sector_name: "Green jobs", is_priority: true, unique_users: 137, total_inquiries: 289 },
    { sector_name: "Education", is_priority: false, unique_users: 130, total_inquiries: 244 },
    { sector_name: "Finance", is_priority: false, unique_users: 116, total_inquiries: 198 },
  ],
  degraded: false,
};

const stubJobs: JobsResponse = {
  summary: {
    jobs_sourced: 30_610,
    profiles_with_matches: 879,
    profiles_with_matches_percentage: 21,
    jobs_viewed_per_user: 8.4,
  },
  degraded: false,
};

const stubMe: MeResponse = {
  user_id: "dev-funder",
  email: "funder@example.com",
  name: "Dev Funder",
  organization: "Dev Fund",
  role: "funder",
  permissions: ["dashboard:view", "institutions:view", "account:view", "access_management:manage"],
  scope: { institution_ids: null },
  active_modules: ["build-your-profile", "job-readiness", "career-explorer", "jobs"],
};

const stubRoles: RoleRecord[] = [
  {
    _id: "role-funder",
    name: "funder",
    label: "Funder",
    description: "Deployment-wide visibility across all institutions.",
    permissions: [
      { subject: "dashboard", action: "view" },
      { subject: "institutions", action: "view" },
      { subject: "access_management", action: "manage" },
      { subject: "account", action: "view" },
    ],
    assignable: true,
  },
  {
    _id: "role-implementer",
    name: "implementer",
    label: "Implementer",
    description: "Institution-scoped access for a single implementing partner.",
    permissions: [
      { subject: "dashboard", action: "view" },
      { subject: "jobseekers", action: "view" },
      { subject: "account", action: "view" },
    ],
    assignable: true,
  },
];

const stubUsers: ManagedUser[] = [
  {
    user_id: "user-funder",
    email: "funder@example.com",
    name: "Alice Funder",
    roles: [{ role_id: "role-funder", role_name: "funder", institution_id: null, granted_by: null, granted_at: null }],
  },
  {
    user_id: "user-implementer",
    email: "implementer@example.com",
    name: "Bob Implementer",
    roles: [
      {
        role_id: "role-implementer",
        role_name: "implementer",
        institution_id: "inst-1",
        granted_by: null,
        granted_at: null,
      },
    ],
  },
  {
    user_id: "user-no-access",
    email: "noone@example.com",
    name: "Carol None",
    roles: [],
  },
];

/** Applies the query server-side, the way the real endpoint will: search, filter, sort, paginate. */
export const institutionsHandler = http.get("/api/analytics/institutions", ({ request }) => {
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
export const institutionDetailHandler = http.get("/api/analytics/institutions/:institutionId", ({ params }) => {
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
      scope: params.get("scope") === "all" ? { institutionIds: null } : { institutionIds },
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

/** Stands in for /api/reach — used by tests and Storybook so the Overview screen renders with realistic data. */
export const overviewMetricsHandler = http.get(REACH_API_PATH, () => HttpResponse.json(stubReach));

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

export const rolesHandler = http.get("/api/roles", () => HttpResponse.json(stubRoles));

export const usersHandler = http.get("/api/users", () => HttpResponse.json(stubUsers));

export const assignRoleHandler = http.post("/api/users/:userId/roles", async ({ request }) => {
  const body = (await request.json()) as { role_id: string; institution_id: string | null };
  const role = stubRoles.find((stubRole) => stubRole._id === body.role_id);
  return HttpResponse.json(
    {
      role_id: body.role_id,
      role_name: role?.name ?? "unknown",
      institution_id: body.institution_id,
      granted_by: "dev-funder",
      granted_at: new Date().toISOString(),
    },
    { status: 201 }
  );
});

export const revokeRoleHandler = http.delete(
  "/api/users/:userId/roles/:userRoleId",
  () => new HttpResponse(null, { status: 204 })
);

/** Not in the dev worker, like /api/reach — exported individually so overriding stories can still include it. */
export const buildYourProfileHandler = http.get(`${MODULES_API_BASE}/build-your-profile`, () =>
  HttpResponse.json(stubBuildYourProfile)
);

/** Not in the dev worker, like /api/reach — exported individually so overriding stories can still include it. */
export const demographicsHandler = http.get("/api/demographics", () => HttpResponse.json(stubDemographics));

/** Not in the dev worker, like /api/reach — exported individually so overriding stories can still include it. */
export const careerExplorerHandler = http.get(`${MODULES_API_BASE}/career-explorer`, () =>
  HttpResponse.json(stubCareerExplorer)
);

/** Not in the dev worker, like /api/reach — exported individually so overriding stories can still include it. */
export const jobsHandler = http.get(`${MODULES_API_BASE}/jobs`, () => HttpResponse.json(stubJobs));

/** Full handler list for tests and Storybook, so components render with realistic data without the backend running. */
export const handlers: HttpHandler[] = [
  overviewMetricsHandler,
  jobReadinessHandler,
  institutionsHandler,
  institutionDetailHandler,
  meHandler,
  rolesHandler,
  usersHandler,
  assignRoleHandler,
  revokeRoleHandler,
  http.post("/api/users/register", () => new HttpResponse(null, { status: 201 })),
  http.get("/api/reach", () => HttpResponse.json(stubReach)),
  buildYourProfileHandler,
  demographicsHandler,
  careerExplorerHandler,
  jobsHandler,
  jobseekersHandler,
  jobseekerDetailHandler,
];
