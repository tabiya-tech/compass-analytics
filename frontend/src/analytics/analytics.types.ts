export type Granularity = "day" | "week" | "month";
export type AudienceSegment = "youth" | "women" | "rural" | "first-time-jobseeker";
export type LoginMethod = "email" | "google" | "anonymous";

export interface AnalyticsParams {
  start_date: string;
  end_date: string;
  granularity: Granularity;
  audience_segment?: AudienceSegment;
  login_method?: LoginMethod;
  institution_id?: string;
}

/** Demographics is a snapshot, not a time series, and nothing upstream filters it by
 * audience or login method — so unlike AnalyticsParams, it doesn't accept either. */
export interface DemographicsParams {
  start_date: string;
  end_date: string;
  granularity: Granularity;
  institution_id?: string;
}

export interface ReachSummary {
  total_users: number;
  active_users_30d: number;
  total_logins: number;
  avg_logins_per_user: number;
  avg_session_minutes: number;
}

export interface TimeSeriesPoint {
  label: string;
  cumulative: number;
  added: number;
  new_users: number;
  returning: number;
  logins: number;
}

export interface ReachResponse {
  summary: ReachSummary;
  series: TimeSeriesPoint[];
}

export interface BuildYourProfileSummary {
  started_users: number;
  started_percentage: number;
  completed_users: number;
  avg_completion_minutes: number;
}

export interface BuildYourProfileSeriesPoint {
  label: string;
  started: number;
  completed: number;
  skills_reports_generated: number;
  skills_reports_downloaded: number;
}

/** One funnel stage: how many distinct users reached at least this far in the conversation. */
export interface ConversationPhaseReach {
  id: string;
  reached: number;
}

export interface BuildYourProfileResponse {
  summary: BuildYourProfileSummary;
  series: BuildYourProfileSeriesPoint[];
  phases: ConversationPhaseReach[];
  degraded: boolean;
}

export interface DemographicItem {
  name: string;
  value: number;
}

export type DemographicChartType = "pie-chart" | "horizontal-bar-chart";

/** One demographic dimension the backend can currently break down (e.g. gender, region). More are added as more demographic data becomes available upstream. */
export interface DemographicChart {
  type: DemographicChartType;
  name: string;
  items: DemographicItem[];
}

export interface DemographicsResponse {
  charts: DemographicChart[];
  degraded: boolean;
}

export interface SubModuleProgress {
  id: string;
  name: string;
  started: number;
  completed: number;
}

export interface JobReadinessResponse {
  started_percentage: number;
  sub_modules: SubModuleProgress[];
  degraded: boolean;
}

export interface JobsSummary {
  jobs_sourced: number;
  profiles_with_matches: number;
  profiles_with_matches_percentage: number;
  jobs_viewed_per_user: number;
}

export interface JobsResponse {
  summary: JobsSummary;
  degraded: boolean;
}
