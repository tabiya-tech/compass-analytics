import { MODULE_IDS, type ModuleId } from "@/access/AccessContext";
import { MODULE_ORDER } from "@/access/moduleDisplay";
import type {
  JobseekerDetail,
  JobseekerSummary,
  JobseekersQuery,
  JobseekersResponse,
  ModuleStatus,
} from "@/jobseekers/jobseekers.types";

/**
 * A deterministic stand-in roster: 28 jobseekers across the first two mocked institutions, so a
 * grant covering one of them can be told apart from a grant covering both.
 *
 * Statuses are generated for every module — which of them reaches the table is the deployment's
 * call, not the endpoint's. Dates hang off a fixed reference day so the rows never drift.
 *
 * [name, institution number, profile score %, registered (days ago), last login (days ago),
 *  module statuses in MODULE_ORDER, one char each: n = not started, p = in progress, d = completed]
 */
type MockRow = readonly [string, 1 | 2, number, number, number, string];

const MOCK_ROWS: readonly MockRow[] = [
  ["María González", 1, 100, 152, 3, "dddp"],
  ["Kwame Osei", 1, 70, 148, 12, "pnpd"],
  ["Aisha Mwansa", 1, 100, 141, 1, "ddnp"],
  ["Diego Fernández", 2, 40, 139, 27, "ppnn"],
  ["Chipo Banda", 1, 100, 134, 0, "dpdd"],
  ["Wanjiku Kamau", 1, 5, 130, 44, "nnpn"],
  ["Tomás Silva", 2, 90, 127, 8, "pdnp"],
  ["Nomsa Dlamini", 1, 100, 121, 2, "ddpd"],
  ["Farai Moyo", 1, 15, 118, 61, "pnnn"],
  ["Lucía Torres", 1, 100, 115, 5, "dnpd"],
  ["Blessing Phiri", 2, 70, 110, 19, "ppdn"],
  ["Sofía Ruiz", 1, 100, 106, 4, "dddd"],
  ["Kabelo Molefe", 1, 0, 101, 88, "nnnn"],
  ["Amara Okeke", 1, 100, 97, 6, "dpnp"],
  ["Joseph Tembo", 2, 40, 94, 33, "pnpp"],
  ["Precious Chanda", 1, 100, 89, 1, "ddpn"],
  ["Kwame Banda", 1, 90, 85, 14, "pdpd"],
  ["Aisha Kamau", 2, 100, 80, 7, "dnnd"],
  ["Diego Moyo", 1, 8, 76, 51, "nnpd"],
  ["Chipo Osei", 1, 100, 71, 0, "ddpp"],
  ["Wanjiku Silva", 1, 70, 66, 23, "pnnp"],
  ["Tomás Dlamini", 2, 100, 61, 9, "dpdn"],
  ["Nomsa Torres", 1, 15, 55, 39, "pnpn"],
  ["Farai Ruiz", 1, 100, 50, 2, "dddn"],
  ["Lucía Molefe", 1, 90, 44, 17, "ppnd"],
  ["Blessing Okeke", 2, 100, 38, 3, "dnpd"],
  ["Sofía Tembo", 1, 40, 31, 25, "pndp"],
  ["Kabelo Chanda", 1, 0, 24, 11, "nnnp"],
];

/** The institutions the roster belongs to — the same ids the institutions endpoint serves. */
const INSTITUTION_NAMES: Record<string, string> = {
  "inst-1": "Mazabuka Livelihoods Trust",
  "inst-2": "Chipata Vocational Centre",
};

/** A fixed "today", so "registered 152 days ago" resolves to the same date on every run. */
const REFERENCE_DATE = Date.UTC(2026, 6, 7); // 7 Jul 2026
const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_BY_CHAR: Record<string, ModuleStatus> = {
  n: "not_started",
  p: "in_progress",
  d: "completed",
};

const SKILL_POOL = [
  "Customer service",
  "Inventory management",
  "Cash handling",
  "Team coordination",
  "Cooking",
  "Childcare",
  "Sewing",
  "Data entry",
  "Sales",
  "Bookkeeping",
  "Stock taking",
  "Record keeping",
];

const GENDERS = ["Female", "Male", "Not available"];
const EDUCATION_LEVELS = ["Secondary", "Tertiary", "Primary"];
const BUILD_YOUR_PROFILE_PHASES = ["Intro", "Experiences", "Skills", "Review"];
const JOB_READINESS_STEPS = ["CV Builder", "Interview Prep", "Workplace Skills", "Digital Basics"];
const LOCATIONS: Record<string, string> = { "inst-1": "Mazabuka", "inst-2": "Chipata" };

function toIsoDate(daysAgo: number): string {
  return new Date(REFERENCE_DATE - daysAgo * DAY_MS).toISOString().slice(0, 10);
}

/** Index-derived, so every jobseeker gets stable variety without random values. */
function pick<T>(options: readonly T[], index: number): T {
  return options[index % options.length];
}

/** The skills the report captured — 3 to 6 of the pool, a different slice per jobseeker. */
function skillsFor(index: number): string[] {
  const count = 3 + (index % 4);
  return Array.from({ length: count }, (_, offset) => pick(SKILL_POOL, index + offset * 3));
}

function moduleStatusOf(statuses: string, moduleId: ModuleId): ModuleStatus {
  return STATUS_BY_CHAR[statuses[MODULE_ORDER.indexOf(moduleId)]] ?? "not_started";
}

export const MOCK_JOBSEEKERS: readonly JobseekerSummary[] = MOCK_ROWS.map(
  ([name, institutionNumber, profileScore, registeredDaysAgo, lastLoginDaysAgo, statuses], index) => {
    const institutionId = `inst-${institutionNumber}`;
    const reportReady = moduleStatusOf(statuses, MODULE_IDS.BUILD_YOUR_PROFILE) === "completed";

    return {
      id: `JS-${10_230 + index}`,
      name,
      institution_id: institutionId,
      institution_name: INSTITUTION_NAMES[institutionId],
      profile_score_pct: profileScore,
      registered_at: toIsoDate(registeredDaysAgo),
      last_login_at: toIsoDate(lastLoginDaysAgo),
      module_status: Object.fromEntries(
        MODULE_ORDER.map((moduleId) => [moduleId, moduleStatusOf(statuses, moduleId)])
      ) as Partial<Record<ModuleId, ModuleStatus>>,
      // The Skills Report is a Build Your Profile output — nothing to show until that is finished.
      skills_report_ready: reportReady,
      skills: reportReady ? skillsFor(index) : [],
    };
  }
);

/** Steps a jobseeker has yet to reach stay "not started"; a finished module has none left. */
function subModuleStatus(moduleStatus: ModuleStatus, index: number, step: number): ModuleStatus {
  if (moduleStatus === "not_started") return "not_started";
  if (moduleStatus === "completed") return "completed";
  return pick(["completed", "in_progress", "not_started"] as const, index + step);
}

function buildJobseekerDetail(jobseeker: JobseekerSummary): JobseekerDetail {
  const index = MOCK_JOBSEEKERS.indexOf(jobseeker);
  const downloaded = jobseeker.skills_report_ready && index % 3 !== 0;

  const modules = MODULE_ORDER.map((moduleId) => {
    const status = jobseeker.module_status[moduleId] ?? "not_started";
    return {
      module_id: moduleId,
      status,
      phase:
        moduleId === MODULE_IDS.BUILD_YOUR_PROFILE && status !== "not_started"
          ? status === "completed"
            ? "Completed"
            : pick(BUILD_YOUR_PROFILE_PHASES, index)
          : undefined,
      sub_modules:
        moduleId === MODULE_IDS.JOB_READINESS
          ? JOB_READINESS_STEPS.map((name, step) => ({
              id: name.toLowerCase().replaceAll(" ", "-"),
              name,
              status: subModuleStatus(status, index, step),
            }))
          : undefined,
    };
  });

  return {
    id: jobseeker.id,
    name: jobseeker.name,
    institution_id: jobseeker.institution_id,
    institution_name: jobseeker.institution_name,
    profile_score_pct: jobseeker.profile_score_pct,
    demographics: {
      gender: pick(GENDERS, index),
      age: 18 + (index % 24),
      location: LOCATIONS[jobseeker.institution_id],
      education: pick(EDUCATION_LEVELS, index),
    },
    login_activity: {
      registered_at: jobseeker.registered_at,
      last_login_at: jobseeker.last_login_at,
      total_logins: 1 + (index % 22),
      login_method: index % 2 === 0 ? "google" : "email",
    },
    modules,
    outputs: {
      skills_report_generated: jobseeker.skills_report_ready,
      // Not everyone who generated a report went on to download it, and only some of those
      // shared it — so the three figures always step down rather than contradict each other.
      downloaded,
      shared: downloaded && index % 4 === 0,
    },
    skills: jobseeker.skills,
  };
}

/** The drill-down for one jobseeker, or undefined when no such jobseeker exists. */
export function findJobseekerDetail(jobseekerId: string): JobseekerDetail | undefined {
  const jobseeker = MOCK_JOBSEEKERS.find((candidate) => candidate.id === jobseekerId);
  return jobseeker && buildJobseekerDetail(jobseeker);
}

/** A jobseeker with no recorded date sorts as the earliest one, rather than breaking the compare. */
function sortValueOf(jobseeker: JobseekerSummary, key: JobseekersQuery["sort"]["by"]): string | number {
  switch (key) {
    case "profile_score_pct":
      return jobseeker.profile_score_pct;
    case "registered_at":
      return jobseeker.registered_at ?? "";
    case "last_login_at":
      return jobseeker.last_login_at ?? "";
    default:
      return jobseeker.name;
  }
}

/**
 * Stands in for the real endpoint's query: scope, search, module-status filter, sort, pagination.
 *
 * The scope check is first and unconditional — a real endpoint derives it from the caller's token
 * rather than the request, but the shape of the guarantee is the same: no row from an institution
 * outside the grant ever reaches the response.
 */
export function queryJobseekers(query: JobseekersQuery): JobseekersResponse {
  const search = query.search?.trim().toLowerCase() ?? "";
  const filters = Object.entries(query.module_status ?? {}).filter(([, statuses]) => statuses && statuses.length > 0);

  const scope = query.scope;
  const inScope =
    scope.institutionIds === null
      ? MOCK_JOBSEEKERS
      : MOCK_JOBSEEKERS.filter((jobseeker) => scope.institutionIds!.includes(jobseeker.institution_id));

  const matching = inScope.filter((jobseeker) => {
    const matchesSearch =
      !search || jobseeker.name.toLowerCase().includes(search) || jobseeker.id.toLowerCase().includes(search);
    const matchesFilters = filters.every(([moduleId, statuses]) =>
      statuses?.includes(jobseeker.module_status[moduleId as ModuleId] ?? "not_started")
    );
    return matchesSearch && matchesFilters;
  });

  const direction = query.sort.direction === "asc" ? 1 : -1;
  const sorted = [...matching].sort((a, b) => {
    const left = sortValueOf(a, query.sort.by);
    const right = sortValueOf(b, query.sort.by);
    if (typeof left === "string" && typeof right === "string") return left.localeCompare(right) * direction;
    return ((left as number) - (right as number)) * direction;
  });

  const start = (query.page - 1) * query.page_size;

  return {
    items: sorted.slice(start, start + query.page_size),
    total: sorted.length,
    page: query.page,
    page_size: query.page_size,
  };
}
