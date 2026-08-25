/** Deterministic stand-in for the per-module metrics endpoint, until the backend serves it — every figure is a pure function of the request, so a re-render, a story and a test all see the same numbers. */

import { MODULE_IDS, type ModuleId } from "@/access/AccessContext";
import type { AudienceSegmentId, LoginMethodId } from "@/filters/filters";
import type { MetricsScope } from "@/pages/Overview/overview.types";
// Import shared utility instead of redefining locally to prevent drift.
import { percentageOf } from "@/components/charts/chart-scale";
import {
  AUDIENCE_SEGMENT_FACTOR,
  LOGIN_METHOD_FACTOR,
  jitter,
  selectMockInstitutions,
  type MockInstitution,
} from "@/mocks/overview-metrics";

import {
  BUILD_YOUR_PROFILE_TARGET_MINUTES,
  type ConversationPhaseId,
  type ModuleMetrics,
  type ModuleMetricsRequest,
  type ModuleMetricsResponse,
} from "@/pages/Modules/types";

/** The institution the designs are drawn from: its shares are used unmodified, so the screen matches the mockups. */
const DESIGN_INSTITUTION_ID = "inst-1";

/** Share of the jobseekers in scope who started each module. */
const MODULE_START_SHARES: Record<ModuleId, number> = {
  [MODULE_IDS.BUILD_YOUR_PROFILE]: 0.4366,
  [MODULE_IDS.JOB_READINESS]: 0.34,
  [MODULE_IDS.CAREER_EXPLORER]: 0.18,
  [MODULE_IDS.JOBS]: 0.26,
};

/** Share of those who started Build Your Profile who reached each phase — the first phase is everyone who started. */
const CONVERSATION_PHASE_SHARES: readonly { id: ConversationPhaseId; share: number }[] = [
  { id: "intro", share: 1 },
  { id: "experiences", share: 0.8598 },
  { id: "skills", share: 0.6396 },
  { id: "completed", share: 0.2792 },
];

/** How long a completed conversation takes, against that target. */
const BUILD_YOUR_PROFILE_MINUTES = 12;

/** Which steps Job Readiness runs is deployment configuration; these are the four the designs show. */
const SUB_MODULE_PROFILES: readonly { id: string; name: string; startShare: number; completionShare: number }[] = [
  { id: "cv-builder", name: "CV Builder", startShare: 0.2467, completionShare: 0.5522 },
  { id: "interview-prep", name: "Interview Prep", startShare: 0.3436, completionShare: 0.6544 },
  { id: "workplace-skills", name: "Workplace Skills", startShare: 0.2606, completionShare: 0.6747 },
  { id: "digital-basics", name: "Digital Basics", startShare: 0.2166, completionShare: 0.4911 },
];

/** Explorations per jobseeker in scope, by sector. */
const SECTOR_PROFILES: readonly { id: string; label: string; share: number }[] = [
  { id: "healthcare", label: "Healthcare", share: 0.04565 },
  { id: "technology", label: "Technology", share: 0.03691 },
  { id: "green-jobs", label: "Green jobs", share: 0.03327 },
  { id: "education", label: "Education", share: 0.03157 },
  { id: "finance", label: "Finance", share: 0.02817 },
];

const JOB_CATEGORY_PROFILES: readonly { id: string; label: string; share: number }[] = [
  { id: "retail-sales", label: "Retail & sales", share: 0.0611 },
  { id: "hospitality", label: "Hospitality", share: 0.0524 },
  { id: "construction", label: "Construction", share: 0.0438 },
  { id: "agriculture", label: "Agriculture", share: 0.0372 },
  { id: "logistics", label: "Logistics", share: 0.0295 },
];

/** Jobs in the classifier feed per jobseeker in scope. */
const JOBS_SOURCED_PER_USER = 7.4332;
const PROFILES_WITH_MATCHES_SHARE = 0.2134;
const JOBS_VIEWED_PER_USER = 8.4;

function filterFactor(request: ModuleMetricsRequest): number {
  const bySegment = request.audienceSegment ? AUDIENCE_SEGMENT_FACTOR : 1;
  const byLoginMethod = request.loginMethod ? LOGIN_METHOD_FACTOR : 1;
  return bySegment * byLoginMethod;
}

/** How far an institution's engagement sits from the design's, so a portfolio isn't the same percentages at scale. */
function engagementFactor(institution: MockInstitution, ...seed: string[]): number {
  if (institution.id === DESIGN_INSTITUTION_ID) return 1;
  return jitter(0.72, 1.24, institution.id, ...seed);
}

/** One institution's raw counts. Percentages are recomputed from the summed counts, never averaged between them. */
interface ModuleCounts {
  users: number;
  started: number;
  phasesReached: number[];
  minutesToComplete: number; // weighted by `started`, divided out at the end
  subModules: { started: number; completed: number }[];
  sectorExplorations: number[];
  jobsSourced: number;
  profilesWithMatches: number;
  jobsViewed: number; // weighted by `users`, divided out at the end
  categoryMatches: number[];
}

function countsFor(institution: MockInstitution, moduleId: ModuleId, request: ModuleMetricsRequest): ModuleCounts {
  const users = Math.round(institution.users * filterFactor(request));
  const started = Math.round(users * MODULE_START_SHARES[moduleId] * engagementFactor(institution, moduleId));

  return {
    users,
    started,
    phasesReached: CONVERSATION_PHASE_SHARES.map((phase, index) =>
      Math.round(started * phase.share * engagementFactor(institution, "phase", String(index)))
    ),
    minutesToComplete: BUILD_YOUR_PROFILE_MINUTES * engagementFactor(institution, "byp-minutes") * started,
    subModules: SUB_MODULE_PROFILES.map((subModule) => {
      const subStarted = Math.round(users * subModule.startShare * engagementFactor(institution, subModule.id));
      return {
        started: subStarted,
        completed: Math.round(
          subStarted * subModule.completionShare * engagementFactor(institution, subModule.id, "c")
        ),
      };
    }),
    sectorExplorations: SECTOR_PROFILES.map((sector) =>
      Math.round(users * sector.share * engagementFactor(institution, sector.id))
    ),
    jobsSourced: Math.round(users * JOBS_SOURCED_PER_USER * engagementFactor(institution, "sourced")),
    profilesWithMatches: Math.round(users * PROFILES_WITH_MATCHES_SHARE * engagementFactor(institution, "matches")),
    jobsViewed: JOBS_VIEWED_PER_USER * engagementFactor(institution, "viewed") * users,
    categoryMatches: JOB_CATEGORY_PROFILES.map((category) =>
      Math.round(users * category.share * engagementFactor(institution, category.id))
    ),
  };
}

function sumBy<T>(items: readonly T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

/** Element-wise sum of same-length count vectors — one entry per phase, sector or category. */
function sumVectors(vectors: readonly number[][]): number[] {
  // Guard empty array to prevent crash when no institutions match
  const first = vectors[0] ?? [];
  return first.map((_, index) => sumBy(vectors, (vector) => vector[index]));
}

function totalCounts(parts: readonly ModuleCounts[]): ModuleCounts {
  return {
    users: sumBy(parts, (part) => part.users),
    started: sumBy(parts, (part) => part.started),
    phasesReached: sumVectors(parts.map((part) => part.phasesReached)),
    minutesToComplete: sumBy(parts, (part) => part.minutesToComplete),
    subModules: SUB_MODULE_PROFILES.map((_, index) => ({
      started: sumBy(parts, (part) => part.subModules[index].started),
      completed: sumBy(parts, (part) => part.subModules[index].completed),
    })),
    sectorExplorations: sumVectors(parts.map((part) => part.sectorExplorations)),
    jobsSourced: sumBy(parts, (part) => part.jobsSourced),
    profilesWithMatches: sumBy(parts, (part) => part.profilesWithMatches),
    jobsViewed: sumBy(parts, (part) => part.jobsViewed),
    categoryMatches: sumVectors(parts.map((part) => part.categoryMatches)),
  };
}

function oneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Highest first — the panels read as rankings, and the API is what settles the order. */
function rankDescending<T extends { value: number }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => right.value - left.value);
}

function metricsFor(moduleId: ModuleId, counts: ModuleCounts): ModuleMetrics {
  const startedPercentage = percentageOf(counts.started, counts.users);

  switch (moduleId) {
    case MODULE_IDS.BUILD_YOUR_PROFILE: {
      const phases = CONVERSATION_PHASE_SHARES.map((phase, index) => ({
        id: phase.id,
        reached: counts.phasesReached[index],
      }));
      const entered = phases[0]?.reached ?? 0;
      const cvsGenerated = phases[phases.length - 1]?.reached ?? 0;

      return {
        moduleId: MODULE_IDS.BUILD_YOUR_PROFILE,
        startedPercentage,
        cvsGenerated,
        cvsGeneratedSharePercentage: percentageOf(cvsGenerated, entered),
        averageMinutesToComplete: counts.started > 0 ? oneDecimal(counts.minutesToComplete / counts.started) : 0,
        targetMinutes: BUILD_YOUR_PROFILE_TARGET_MINUTES,
        phases,
        degraded: false,
      };
    }
    case MODULE_IDS.JOB_READINESS:
      return {
        moduleId: MODULE_IDS.JOB_READINESS,
        startedPercentage,
        subModules: SUB_MODULE_PROFILES.map((subModule, index) => ({
          id: subModule.id,
          name: subModule.name,
          started: counts.subModules[index].started,
          completed: counts.subModules[index].completed,
        })),
      };
    case MODULE_IDS.CAREER_EXPLORER:
      return {
        moduleId: MODULE_IDS.CAREER_EXPLORER,
        startedPercentage,
        topSectors: rankDescending(
          SECTOR_PROFILES.map((sector, index) => ({ ...sector, value: counts.sectorExplorations[index] }))
        ).map((sector) => ({ id: sector.id, label: sector.label, explorations: sector.value })),
      };
    case MODULE_IDS.JOBS:
      return {
        moduleId: MODULE_IDS.JOBS,
        startedPercentage,
        jobsSourced: counts.jobsSourced,
        profilesWithMatches: counts.profilesWithMatches,
        profilesWithMatchesSharePercentage: percentageOf(counts.profilesWithMatches, counts.users),
        jobsViewedPerUser: counts.users > 0 ? oneDecimal(counts.jobsViewed / counts.users) : 0,
        topCategories: rankDescending(
          JOB_CATEGORY_PROFILES.map((category, index) => ({ ...category, value: counts.categoryMatches[index] }))
        ).map((category) => ({ id: category.id, label: category.label, matches: category.value })),
      };
  }
}

/** One institution in scope reports as itself; anything else reports as a portfolio. */
function scopeFor(institutions: readonly MockInstitution[]): MetricsScope {
  return institutions.length === 1
    ? { type: "institution", institutionId: institutions[0].id, institutionName: institutions[0].name }
    : { type: "portfolio", institutionCount: institutions.length };
}

export function buildModuleMetrics(request: ModuleMetricsRequest): ModuleMetricsResponse {
  const institutions = selectMockInstitutions(request.institutions);

  return {
    scope: scopeFor(institutions),
    dateRange: request.dateRange,
    // Only the modules asked for, in the order asked for.
    modules: request.modules.map((moduleId) =>
      metricsFor(moduleId, totalCounts(institutions.map((institution) => countsFor(institution, moduleId, request))))
    ),
  };
}

const MODULE_ID_VALUES: readonly string[] = Object.values(MODULE_IDS);

/** Unknown module ids are dropped rather than served as empty bodies. */
function asModuleIds(values: readonly string[]): ModuleId[] {
  return values.filter((value): value is ModuleId => MODULE_ID_VALUES.includes(value));
}

export function parseModuleMetricsQuery(params: URLSearchParams): ModuleMetricsRequest {
  const institutions = params.get("institutions") ?? "all";
  const moduleParams = params.getAll("modules");
  // Omitted param = all modules (default). Empty string param = explicitly zero modules.
  const hasExplicitEmpty = moduleParams.some((m) => m === "");
  const modules = hasExplicitEmpty ? [] : asModuleIds(moduleParams);

  return {
    institutions: institutions === "all" ? "all" : institutions.split(",").filter(Boolean),
    modules: modules.length > 0 ? modules : moduleParams.length === 0 ? (MODULE_ID_VALUES as ModuleId[]) : [],
    dateRange: { start: params.get("start") ?? "", end: params.get("end") ?? "" },
    audienceSegment: (params.get("audienceSegment") as AudienceSegmentId | null) ?? null,
    loginMethod: (params.get("loginMethod") as LoginMethodId | null) ?? null,
  };
}
