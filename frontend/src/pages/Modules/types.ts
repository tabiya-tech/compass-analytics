import type { MODULE_IDS, ModuleId } from "@/access/AccessContext";
import type { AudienceSegmentId, DateRange, LoginMethodId } from "@/filters/filters";
import type { MetricsScope, RequestedInstitutions } from "@/pages/Overview/overview.types";

/** No granularity: every figure is a single total over the window, not a time series. */
export interface ModuleMetricsRequest {
  institutions: RequestedInstitutions;
  modules: readonly ModuleId[]; // the deployment's active modules, in the order they are shown
  dateRange: DateRange;
  audienceSegment?: AudienceSegmentId | null;
  loginMethod?: LoginMethodId | null;
}

/** The phases of the Build Your Profile conversation, in the order they are reached. */
export type ConversationPhaseId = "intro" | "experiences" | "skills" | "completed";

export interface ConversationPhaseMetric {
  id: ConversationPhaseId;
  reached: number;
}

/** The share of jobseekers in scope who started the module — what the timeline plots. */
interface ModuleMetricsBase {
  startedPercentage: number;
}

/** A fixed product benchmark, not upstream data — shared by the real fetch and its mock, so a change to one can't silently drift from the other. */
export const BUILD_YOUR_PROFILE_TARGET_MINUTES = 30;

export interface BuildYourProfileMetrics extends ModuleMetricsBase {
  moduleId: typeof MODULE_IDS.BUILD_YOUR_PROFILE;
  cvsGenerated: number;
  cvsGeneratedSharePercentage: number; // of those who started, not of everyone in scope
  averageMinutesToComplete: number;
  targetMinutes: number;
  phases: readonly ConversationPhaseMetric[];
  degraded: boolean; // true when the fetch failed, or the backend itself reported a degraded upstream
}

/** A step within Job Readiness. Which steps a deployment runs is its own configuration, so the name travels with it. */
export interface SubModuleProgress {
  id: string;
  name: string;
  started: number;
  completed: number;
}

export interface JobReadinessMetrics extends ModuleMetricsBase {
  moduleId: typeof MODULE_IDS.JOB_READINESS;
  subModules: readonly SubModuleProgress[];
}

/** Sectors are taxonomy data rather than UI copy, so the label comes with the payload. */
export interface SectorBucket {
  id: string;
  label: string;
  explorations: number;
}

export interface CareerExplorerMetrics extends ModuleMetricsBase {
  moduleId: typeof MODULE_IDS.CAREER_EXPLORER;
  topSectors: readonly SectorBucket[];
}

export interface JobCategoryBucket {
  id: string;
  label: string;
  matches: number;
}

export interface JobsMetrics extends ModuleMetricsBase {
  moduleId: typeof MODULE_IDS.JOBS;
  jobsSourced: number;
  profilesWithMatches: number;
  profilesWithMatchesSharePercentage: number;
  jobsViewedPerUser: number;
  topCategories: readonly JobCategoryBucket[];
  degraded: boolean; // true when the fetch failed, or the backend itself reported a degraded upstream
}

/** Discriminated on `moduleId`, so a body can only read the figures its own module reports. */
export type ModuleMetrics = BuildYourProfileMetrics | JobReadinessMetrics | CareerExplorerMetrics | JobsMetrics;

export interface ModuleMetricsResponse {
  scope?: MetricsScope;
  dateRange: DateRange; // echoed back, so a stale response can be told apart from the current one
  modules: readonly ModuleMetrics[];
}
