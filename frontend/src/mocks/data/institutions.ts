import { MODULE_IDS } from "@/access/AccessContext";
import { MODULE_ORDER } from "@/access/moduleDisplay";
import type {
  InstitutionDetail,
  InstitutionSummary,
  InstitutionsQuery,
  InstitutionsResponse,
  InstitutionsTotals,
} from "@/institutions/institutions.types";

/**
 * A deterministic stand-in portfolio: 30 institutions across Zambia's provinces. Every module
 * carries a figure — which of them reaches the screen is the deployment's call, not the endpoint's.
 *
 * [name, region, registered users, active users, BYP %, job readiness %, career explorer %, jobs %, skills reports]
 */
type MockRow = readonly [string, string, number, number, number, number, number, number, number];

const MOCK_ROWS: readonly MockRow[] = [
  ["Mazabuka Livelihoods Trust", "Southern", 4685, 1643, 46, 35, 22, 31, 1204],
  ["Chipata Vocational Centre", "Eastern", 4339, 1810, 52, 37, 22, 34, 1187],
  ["Kapiri Mposhi Opportunity Centre", "Central", 4173, 1627, 54, 38, 25, 29, 1102],
  ["Kabwe Youth Connect", "Central", 4138, 1408, 51, 35, 23, 33, 1056],
  ["Mansa Livelihoods Trust", "Luapula", 4122, 1659, 56, 32, 22, 30, 1148],
  ["Ndola Livelihoods Trust", "Copperbelt", 4121, 1705, 44, 34, 18, 28, 993],
  ["Lusaka Skills Hub", "Lusaka", 3987, 1521, 49, 36, 26, 35, 1076],
  ["Livingstone Youth Foundation", "Southern", 3764, 1387, 47, 33, 21, 27, 902],
  ["Kasama Employment Network", "Northern", 3612, 1298, 45, 31, 19, 26, 848],
  ["Solwezi Skills Hub", "North-Western", 3498, 1342, 53, 39, 24, 32, 917],
  ["Choma Vocational Centre", "Southern", 3355, 1201, 48, 30, 20, 29, 823],
  ["Kafue Youth Connect", "Lusaka", 3210, 1264, 50, 34, 25, 31, 861],
  ["Chinsali Opportunity Centre", "Muchinga", 3087, 1043, 43, 28, 17, 24, 706],
  ["Mufulira Employment Network", "Copperbelt", 2954, 1122, 46, 33, 21, 30, 754],
  ["Petauke Livelihoods Trust", "Eastern", 2841, 987, 44, 29, 18, 25, 683],
  ["Kalulushi Skills Hub", "Copperbelt", 2716, 1058, 51, 35, 23, 33, 749],
  ["Serenje Youth Foundation", "Central", 2588, 902, 42, 27, 16, 23, 621],
  ["Nakonde Employment Network", "Muchinga", 2433, 861, 45, 30, 19, 26, 638],
  ["Samfya Vocational Centre", "Luapula", 2298, 812, 47, 32, 20, 28, 645],
  ["Kaoma Youth Connect", "Western", 2154, 764, 43, 28, 17, 24, 574],
  ["Sesheke Skills Hub", "Western", 1987, 698, 46, 31, 21, 27, 561],
  ["Mpika Livelihoods Trust", "Muchinga", 1842, 651, 44, 29, 18, 25, 511],
  ["Mumbwa Youth Foundation", "Central", 1564, 542, 45, 30, 19, 26, 469],
  ["Mwinilunga Youth Foundation", "North-Western", 1421, 697, 51, 35, 29, 35, 223],
  ["Kitwe Employment Network", "Copperbelt", 1288, 525, 49, 34, 23, 42, 165],
  ["Luanshya Skills Hub", "Copperbelt", 1147, 407, 45, 35, 29, 28, 127],
  ["Chingola Vocational Centre", "Copperbelt", 1024, 338, 52, 39, 28, 32, 137],
  ["Katete Skills Hub", "Eastern", 968, 416, 45, 27, 27, 29, 117],
  ["Monze Employment Network", "Southern", 874, 357, 50, 34, 17, 30, 123],
  ["Mongu Skills Hub", "Western", 731, 204, 47, 38, 26, 32, 73],
];

export const MOCK_INSTITUTIONS: readonly InstitutionSummary[] = MOCK_ROWS.map(
  ([name, region, registered, active, byp, jobReadiness, careerExplorer, jobs, skillsReports], index) => ({
    id: `inst-${index + 1}`,
    name,
    region,
    registered_users: registered,
    active_users: active,
    module_started_pct: {
      [MODULE_IDS.BUILD_YOUR_PROFILE]: byp,
      [MODULE_IDS.JOB_READINESS]: jobReadiness,
      [MODULE_IDS.CAREER_EXPLORER]: careerExplorer,
      [MODULE_IDS.JOBS]: jobs,
    },
    skills_reports: skillsReports,
  })
);

const PORTFOLIO_TOTALS: InstitutionsTotals = {
  jobseekers_reached: MOCK_INSTITUTIONS.reduce((sum, institution) => sum + institution.registered_users, 0),
  skills_reports: MOCK_INSTITUTIONS.reduce((sum, institution) => sum + (institution.skills_reports ?? 0), 0),
  institutions: MOCK_INSTITUTIONS.length,
};

const AVAILABLE_REGIONS = [...new Set(MOCK_INSTITUTIONS.map((institution) => institution.region))].sort((a, b) =>
  a.localeCompare(b)
);

// Detail figures are derived from the row above, so the modal can never disagree with the table.
const CITIES: Record<string, string> = { "Kapiri Mposhi Opportunity Centre": "Kapiri Mposhi" };
const LEAD_PMS = ["Isaac Chirwa", "Naomi Banda", "Peter Mwale", "Grace Phiri", "Daniel Zulu", "Ruth Tembo"];
const AGE_BANDS = ["18–24", "25–34", "35–44"];
const LARGEST_GROUPS = ["Women", "Youth", "Rural"];
const EDUCATION_LEVELS = ["Secondary", "Primary", "Tertiary"];
const JOB_READINESS_STEPS = ["CV Builder", "Interview Prep", "Workplace Skills", "Digital Basics"];

/** The town an institution serves — its name leads with it, bar two-word exceptions. */
function cityOf(institution: InstitutionSummary): string {
  return CITIES[institution.name] ?? institution.name.split(" ")[0];
}

/** Index-derived, so every institution gets stable variety without random values. */
function pick<T>(options: readonly T[], index: number): T {
  return options[index % options.length];
}

function buildInstitutionDetail(institution: InstitutionSummary): InstitutionDetail {
  const index = MOCK_INSTITUTIONS.indexOf(institution);
  const startedPct = institution.module_started_pct;
  const skillsReports = institution.skills_reports ?? 0;

  const modules = MODULE_ORDER.filter((moduleId) => startedPct[moduleId] !== undefined).map((moduleId) => ({
    module_id: moduleId,
    started_pct: startedPct[moduleId] as number,
    highlight_value: {
      [MODULE_IDS.BUILD_YOUR_PROFILE]: skillsReports,
      [MODULE_IDS.JOB_READINESS]: undefined, // its caption names the programme instead
      [MODULE_IDS.CAREER_EXPLORER]: Math.round(institution.registered_users * 0.22),
      [MODULE_IDS.JOBS]: Math.round(institution.registered_users * 0.3),
    }[moduleId],
    sub_modules:
      moduleId === MODULE_IDS.JOB_READINESS
        ? JOB_READINESS_STEPS.map((name, step) => ({
            id: name.toLowerCase().replaceAll(" ", "-"),
            name,
            started: Math.round(institution.registered_users * (0.37 - step * 0.06)),
            completed_pct: 47 + ((index + step * 5) % 20),
          }))
        : undefined,
  }));

  return {
    id: institution.id,
    name: institution.name,
    city: cityOf(institution),
    region: institution.region,
    lead_pm: pick(LEAD_PMS, index),
    // Completed profiles as a share of the registered base — one skills report per completion.
    profile_score_pct:
      institution.skills_reports === undefined
        ? undefined
        : Math.round((skillsReports / institution.registered_users) * 100),
    reach: {
      registered_users: institution.registered_users,
      active_users_30d: institution.active_users,
      top_age_band: pick(AGE_BANDS, index),
      largest_group: pick(LARGEST_GROUPS, index),
      most_common_education: pick(EDUCATION_LEVELS, index),
    },
    login_activity: {
      // The more of the base still active, the more often the average user comes back.
      avg_logins_per_user: 3 + Math.round((institution.active_users / institution.registered_users) * 10) / 10,
      total_logins: institution.registered_users * 2 + institution.active_users * 3,
      avg_session_minutes: 6 + (index % 7),
      google_login_pct: 50 + (index % 20),
      email_login_pct: 50 - (index % 20),
    },
    modules,
    outputs:
      institution.skills_reports === undefined
        ? undefined
        : {
            skills_reports_generated: skillsReports,
            downloaded: Math.round(skillsReports * 0.62),
            jobs_sourced: 19_500,
            // 11.3–16.3 minutes, so some institutions sit either side of the 15-minute target.
            avg_time_to_complete_minutes: 11.3 + (index % 6),
            target_minutes: 15,
          },
  };
}

/** The drill-down for one institution, or undefined when no such institution exists. */
export function findInstitutionDetail(institutionId: string): InstitutionDetail | undefined {
  const institution = MOCK_INSTITUTIONS.find((candidate) => candidate.id === institutionId);
  return institution && buildInstitutionDetail(institution);
}

function sortValueOf(institution: InstitutionSummary, key: InstitutionsQuery["sort"]["by"]): string | number {
  switch (key) {
    case "name":
      return institution.name;
    case "registered_users":
      return institution.registered_users;
    case "active_users":
      return institution.active_users;
    case "skills_reports":
      return institution.skills_reports ?? 0;
    default:
      return institution.module_started_pct[key] ?? 0;
  }
}

/** Stands in for the real endpoint's query: search, region filter, sort, then pagination. */
export function queryInstitutions(query: InstitutionsQuery): InstitutionsResponse {
  const search = query.search?.trim().toLowerCase() ?? "";
  const regions = query.regions ?? [];

  const matching = MOCK_INSTITUTIONS.filter((institution) => {
    const matchesSearch = !search || institution.name.toLowerCase().includes(search);
    const matchesRegion = regions.length === 0 || regions.includes(institution.region);
    return matchesSearch && matchesRegion;
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
    totals: PORTFOLIO_TOTALS,
    available_regions: AVAILABLE_REGIONS,
  };
}
