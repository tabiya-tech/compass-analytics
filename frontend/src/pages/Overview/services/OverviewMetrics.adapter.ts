import type { ReachResponse } from "@/analytics/analytics.types";
import type { DateRange, Granularity } from "@/filters/filters";
import { listPeriods } from "@/pages/Overview/utils";
import type {
  CumulativeUsersMetric,
  DailyPoint,
  OverviewMetricsRequest,
  OverviewMetricsResponse,
  ReachPoint,
} from "@/pages/Overview/overview.types";

function computeGrowthPercentage(series: ReachResponse["series"]): number {
  if (series.length < 2) return 0;
  const previous = series[series.length - 2].added;
  const latest = series[series.length - 1].added;
  if (previous === 0) return latest > 0 ? 100 : 0;
  return Math.round(((latest - previous) / previous) * 100);
}

function toCumulativeUsers(reach: ReachResponse): CumulativeUsersMetric {
  const last = reach.series[reach.series.length - 1];
  return {
    total: reach.summary.total_users,
    growthPercentage: computeGrowthPercentage(reach.series),
    asOfPeriod: last?.label ?? "",
  };
}

const RAW_DAILY_LABEL_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** The upstream reach endpoint currently always returns one row per calendar day, ignoring the requested granularity. */
function toReachSeries(reach: ReachResponse, dateRange: DateRange, granularity: Granularity): ReachPoint[] {
  const upstreamIgnoredRequestedGranularity =
    granularity !== "day" && reach.series.every((point) => RAW_DAILY_LABEL_PATTERN.test(point.label));
  if (!upstreamIgnoredRequestedGranularity) {
    return reach.series.map((point) => ({
      period: point.label,
      newUsers: point.new_users,
      returningUsers: point.returning,
    }));
  }

  const periodsAscending = listPeriods(dateRange, granularity);
  const periodsDescending = [...periodsAscending].reverse();
  const totalsByPeriod = new Map<string, { newUsers: number; returningUsers: number }>(
    periodsAscending.map((period) => [period, { newUsers: 0, returningUsers: 0 }])
  );

  for (const dailyPoint of reach.series) {
    const containingPeriod = latestPeriodStartingOnOrBefore(dailyPoint.label, periodsDescending, granularity);
    const totalsForPeriod = totalsByPeriod.get(containingPeriod ?? periodsAscending[0]);
    if (!totalsForPeriod) continue;
    totalsForPeriod.newUsers += dailyPoint.new_users;
    totalsForPeriod.returningUsers += dailyPoint.returning;
  }

  return periodsAscending.map((period) => ({ period, ...totalsByPeriod.get(period)! }));
}

function latestPeriodStartingOnOrBefore(
  isoDay: string,
  periodsDescending: readonly string[],
  granularity: Granularity
): string | undefined {
  return periodsDescending.find((period) => periodStartAsIsoDate(period, granularity) <= isoDay);
}

function periodStartAsIsoDate(period: string, granularity: Granularity): string {
  return granularity === "month" ? `${period}-01` : period;
}

/** The cumulative series from the reach response doubles as the sparkline data. */
function toDailySeries(reach: ReachResponse): DailyPoint[] {
  return reach.series.map((point) => ({
    date: point.label,
    users: point.cumulative,
  }));
}

export function mapReachToOverviewMetrics(
  reach: ReachResponse,
  request: OverviewMetricsRequest
): OverviewMetricsResponse {
  const total = reach.summary.total_users;
  const activeCount = reach.summary.active_users_30d;

  const scope =
    request.institutions === "all" || request.institutions.length !== 1
      ? ({
          type: "portfolio",
          institutionCount: request.institutions === "all" ? 0 : request.institutions.length,
        } as const)
      : ({
          type: "institution",
          institutionId: request.institutions[0],
          institutionName: request.institutions[0],
        } as const);

  return {
    scope,
    dateRange: request.dateRange,
    granularity: request.granularity,
    cumulativeUsers: toCumulativeUsers(reach),
    activeUsers: {
      count: activeCount,
      shareOfUsersPercentage: total === 0 ? 0 : Math.round((activeCount / total) * 100),
      windowDays: 30,
    },
    averageSessionMinutes: reach.summary.avg_session_minutes,
    reachSeries: toReachSeries(reach, request.dateRange, request.granularity),
    dailySeries: toDailySeries(reach),
    loginMethods: [],
    averageLoginsPerUser: reach.summary.avg_logins_per_user,
  };
}

export function buildReachQuery(request: OverviewMetricsRequest): URLSearchParams {
  const query = new URLSearchParams({
    start_date: request.dateRange.start,
    end_date: request.dateRange.end,
    granularity: request.granularity,
  });
  if (request.audienceSegment) query.set("audience_segment", request.audienceSegment);
  if (request.loginMethod) query.set("login_method", request.loginMethod);
  if (request.institutions !== "all" && request.institutions.length === 1) {
    query.set("institution_id", request.institutions[0]);
  }
  return query;
}
