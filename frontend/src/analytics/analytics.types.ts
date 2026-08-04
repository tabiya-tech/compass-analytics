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
