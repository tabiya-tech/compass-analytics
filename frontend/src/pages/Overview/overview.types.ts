import type { AudienceSegmentId, DateRange, Granularity, LoginMethodId } from "@/filters/filters";

/** `"all"` means every institution in the deployment, mirroring AccessScope. */
export type RequestedInstitutions = "all" | readonly string[];

export interface OverviewMetricsRequest {
  institutions: RequestedInstitutions;
  dateRange: DateRange;
  granularity: Granularity;
  audienceSegment?: AudienceSegmentId | null;
  loginMethod?: LoginMethodId | null;
}

/** One institution is named; several are only counted — drilling down is how one is singled out. */
export type MetricsScope =
  | { type: "institution"; institutionId: string; institutionName: string }
  | { type: "portfolio"; institutionCount: number };

/** One bucket of the reach series. `period` is a period key — see @/pages/Overview/utils. */
export interface ReachPoint {
  period: string;
  newUsers: number;
  returningUsers: number;
}

/** One point of the trailing daily series, date as yyyy-MM-dd. */
export interface DailyPoint {
  date: string;
  users: number;
}

export interface CumulativeUsersMetric {
  total: number;
  growthPercentage: number; // vs. the previous bucket; negative means a fall
  asOfPeriod: string; // the bucket the total is stated as of
}

export interface ActiveUsersMetric {
  count: number;
  shareOfUsersPercentage: number;
  windowDays: number;
}

export interface LoginMethodSlice {
  method: LoginMethodId;
  users: number;
}

export type GenderId = "women" | "men" | "undisclosed";
export type AgeBandId = "18-24" | "25-34" | "35-44" | "45-plus";
export type EducationLevelId = "primary" | "secondary" | "tertiary";

/** A bucket whose label is UI copy, keyed off the id. */
export interface DemographicBucket<TId extends string = string> {
  id: TId;
  users: number;
}

/** Regions are deployment-specific data, so the label comes with the payload. */
export interface RegionBucket {
  id: string;
  label: string;
  users: number;
}

export interface Demographics {
  gender: readonly DemographicBucket<GenderId>[];
  ageBands: readonly DemographicBucket<AgeBandId>[];
  educationLevels: readonly DemographicBucket<EducationLevelId>[];
  regions: readonly RegionBucket[];
}

export interface OverviewMetricsResponse {
  scope: MetricsScope;
  dateRange: DateRange; // echoed back, so a stale response can be told apart from the current one
  granularity: Granularity;
  cumulativeUsers: CumulativeUsersMetric;
  activeUsers: ActiveUsersMetric;
  averageSessionMinutes: number;
  reachSeries: readonly ReachPoint[];
  dailySeries: readonly DailyPoint[]; // one point per day, trailing window — backs the sparkline
  loginMethods: readonly LoginMethodSlice[];
  averageLoginsPerUser: number;
  demographics: Demographics;
}
