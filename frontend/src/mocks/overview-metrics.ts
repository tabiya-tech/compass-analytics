/** Deterministic stand-in for the overview metrics endpoint, until the backend serves it — every figure is a pure function of the request, so a re-render, a story and a test all see the same numbers. */

import type {
  AgeBandId,
  DailyPoint,
  Demographics,
  EducationLevelId,
  GenderId,
  LoginMethodSlice,
  OverviewMetricsRequest,
  OverviewMetricsResponse,
  ReachPoint,
  RegionBucket,
  RequestedInstitutions,
} from "@/pages/Overview/overview.types";
import { listPeriods } from "@/pages/Overview/utils";
import { spanInDays, type AudienceSegmentId, type Granularity, type LoginMethodId } from "@/filters/filters";

export interface MockInstitution {
  id: string;
  name: string;
  users: number; // cumulative, over the institution's whole lifetime, before any filtering
  regionShares: readonly number[];
}

const REGIONS: readonly { id: string; label: string }[] = [
  { id: "lusaka", label: "Lusaka" },
  { id: "copperbelt", label: "Copperbelt" },
  { id: "southern", label: "Southern" },
  { id: "eastern", label: "Eastern" },
  { id: "central", label: "Central" },
];

/** The deployment's institutions. `inst-1` is the one the designs are drawn from. */
export const MOCK_INSTITUTIONS: readonly MockInstitution[] = [
  {
    id: "inst-1",
    name: "Ndola Livelihoods Trust",
    users: 4118,
    regionShares: [0.1017, 0.0738, 0.1056, 0.1561, 0.1367],
  },
  { id: "inst-2", name: "Lusaka Youth Futures", users: 2740, regionShares: [0.2412, 0.0611, 0.0704, 0.0819, 0.0955] },
  { id: "inst-3", name: "Copperbelt Skills Hub", users: 1985, regionShares: [0.0642, 0.2788, 0.0511, 0.0733, 0.0821] },
  {
    id: "inst-4",
    name: "Southern Province Works",
    users: 1460,
    regionShares: [0.0588, 0.0497, 0.2611, 0.0702, 0.0644],
  },
  { id: "inst-5", name: "Eastern Jobs Collective", users: 980, regionShares: [0.0511, 0.0463, 0.0598, 0.2455, 0.0721] },
];

/** Shares of the cumulative total, held fixed across institutions — mock data, not a finding. */
const GENDER_SHARES: readonly { id: GenderId; share: number }[] = [
  { id: "women", share: 0.5199 },
  { id: "men", share: 0.4101 },
  { id: "undisclosed", share: 0.07 },
];

const AGE_BAND_SHARES: readonly { id: AgeBandId; share: number }[] = [
  { id: "18-24", share: 0.2412 },
  { id: "25-34", share: 0.1894 },
  { id: "35-44", share: 0.0918 },
  { id: "45-plus", share: 0.0517 },
];

const EDUCATION_SHARES: readonly { id: EducationLevelId; share: number }[] = [
  { id: "primary", share: 0.0804 },
  { id: "secondary", share: 0.2756 },
  { id: "tertiary", share: 0.2181 },
];

const GOOGLE_LOGIN_SHARE = 0.6;
const ACTIVE_USERS_WINDOW_DAYS = 30;
const SPARKLINE_DAYS = 30;
/** How much of the cumulative curve the trailing window covers. */
const SPARKLINE_FLOOR = 0.84;

/** A filtered slice is a subset — the figures have to shrink, or the filters look broken. */
export const AUDIENCE_SEGMENT_FACTOR = 0.45;
export const LOGIN_METHOD_FACTOR = 0.6;

/** A value in [0, 1) from the given key. The same key always gives the same number. */
export function pseudoRandom(...parts: (string | number)[]): number {
  const input = parts.join(":");
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  // Avalanche, so neighbouring keys don't produce neighbouring values.
  hash ^= hash >>> 15;
  return ((hash >>> 0) % 100000) / 100000;
}

export function jitter(min: number, max: number, ...seed: (string | number)[]): number {
  return min + pseudoRandom(...seed) * (max - min);
}

function toUtcDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDays(isoDate: string, days: number): string {
  const date = toUtcDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

/** The last calendar day a bucket covers, so a partial bucket can be scaled down. */
function bucketEnd(period: string, granularity: Granularity): string {
  if (granularity === "month") {
    const date = toUtcDate(period);
    return toIsoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
  }
  return granularity === "week" ? shiftDays(period, 6) : period;
}

/** The share of a bucket the requested range covers — a range ending mid-month leaves that month partial. */
function bucketCoverage(period: string, granularity: Granularity, range: { start: string; end: string }): number {
  const start = period.length === 7 ? `${period}-01` : period;
  const end = bucketEnd(period, granularity);
  const from = start > range.start ? start : range.start;
  const to = end < range.end ? end : range.end;
  const covered = spanInDays(from, to) + 1;
  const total = spanInDays(start, end) + 1;
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, covered / total));
}

function filterFactor(request: OverviewMetricsRequest): number {
  const bySegment = request.audienceSegment ? AUDIENCE_SEGMENT_FACTOR : 1;
  const byLoginMethod = request.loginMethod ? LOGIN_METHOD_FACTOR : 1;
  return bySegment * byLoginMethod;
}

function reachSeriesFor(institution: MockInstitution, request: OverviewMetricsRequest, total: number): ReachPoint[] {
  const periods = listPeriods(request.dateRange, request.granularity);
  if (periods.length === 0) return [];

  // Most of the cumulative total, spread across the window — keeps the bars and the headline figure in the same order of magnitude.
  const perBucket = (total * 0.75) / periods.length;

  return periods.map((period) => {
    const coverage = bucketCoverage(period, request.granularity, request.dateRange);
    const newUsers = Math.round(perBucket * jitter(0.55, 1.5, institution.id, period, "new") * coverage);
    const returningUsers = Math.round(newUsers * jitter(0.28, 0.52, institution.id, period, "returning"));
    return { period, newUsers, returningUsers };
  });
}

/** Cumulative users sampled once a day over the trailing window — monotonic, by definition. */
function dailySeriesFor(total: number, endDate: string): DailyPoint[] {
  return Array.from({ length: SPARKLINE_DAYS }, (_, index) => {
    const progress = index / (SPARKLINE_DAYS - 1);
    return {
      date: shiftDays(endDate, index - (SPARKLINE_DAYS - 1)),
      users: Math.round(total * (SPARKLINE_FLOOR + (1 - SPARKLINE_FLOOR) * progress ** 1.4)),
    };
  });
}

/** Last bucket against the one before it. A partial last bucket reads as a fall. */
function growthPercentageOf(reachSeries: readonly ReachPoint[]): number {
  if (reachSeries.length < 2) return 0;
  const previous = reachSeries[reachSeries.length - 2].newUsers;
  const latest = reachSeries[reachSeries.length - 1].newUsers;
  if (previous === 0) return latest > 0 ? 100 : 0;
  return Math.round(((latest - previous) / previous) * 100);
}

function loginMethodsFor(total: number, requested: LoginMethodId | null | undefined): LoginMethodSlice[] {
  const split: LoginMethodSlice[] = [
    { method: "google", users: Math.round(total * GOOGLE_LOGIN_SHARE) },
    { method: "email", users: total - Math.round(total * GOOGLE_LOGIN_SHARE) },
  ];
  // Filtering to one method leaves one slice — a full ring, not a 60/40 split.
  return requested ? split.filter((slice) => slice.method === requested) : split;
}

function demographicsFor(institution: MockInstitution, total: number): Demographics {
  const regions: RegionBucket[] = REGIONS.map((region, index) => ({
    ...region,
    users: Math.round(total * (institution.regionShares[index] ?? 0)),
  }));

  return {
    gender: GENDER_SHARES.map(({ id, share }) => ({ id, users: Math.round(total * share) })),
    ageBands: AGE_BAND_SHARES.map(({ id, share }) => ({ id, users: Math.round(total * share) })),
    educationLevels: EDUCATION_SHARES.map(({ id, share }) => ({ id, users: Math.round(total * share) })),
    regions,
  };
}

/** Everything the Overview screen needs for one institution. */
export function metricsFor(institution: MockInstitution, request: OverviewMetricsRequest): OverviewMetricsResponse {
  const total = Math.round(institution.users * filterFactor(request));
  const reachSeries = reachSeriesFor(institution, request, total);
  // The ranges are set so `inst-1` lands on the figures the designs show.
  const activeShare = Math.round(jitter(0.36, 0.56, institution.id, "active") * 100);

  return {
    scope: { type: "institution", institutionId: institution.id, institutionName: institution.name },
    dateRange: request.dateRange,
    granularity: request.granularity,
    cumulativeUsers: {
      total,
      growthPercentage: growthPercentageOf(reachSeries),
      asOfPeriod: reachSeries[reachSeries.length - 1]?.period ?? request.dateRange.end,
    },
    activeUsers: {
      count: Math.round((total * activeShare) / 100),
      shareOfUsersPercentage: activeShare,
      windowDays: ACTIVE_USERS_WINDOW_DAYS,
    },
    averageSessionMinutes: Math.round(jitter(6, 10, institution.id, "session")),
    reachSeries,
    dailySeries: dailySeriesFor(total, request.dateRange.end),
    loginMethods: loginMethodsFor(total, request.loginMethod),
    averageLoginsPerUser: Math.round(jitter(1.6, 2.4, institution.id, "logins") * 10) / 10,
    demographics: demographicsFor(institution, total),
  };
}

function sumBy<T>(items: readonly T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

/** Weighted by each institution's user count — a small institution can't drag the mean. */
function weightedAverage(parts: readonly OverviewMetricsResponse[], pick: (part: OverviewMetricsResponse) => number) {
  const weight = sumBy(parts, (part) => part.cumulativeUsers.total);
  if (weight === 0) return 0;
  return sumBy(parts, (part) => pick(part) * part.cumulativeUsers.total) / weight;
}

/** Sums the per-bucket figures across institutions, keeping the buckets aligned. */
function aggregateReachSeries(parts: readonly OverviewMetricsResponse[]): ReachPoint[] {
  const periods = parts[0]?.reachSeries.map((point) => point.period) ?? [];
  return periods.map((period, index) => ({
    period,
    newUsers: sumBy(parts, (part) => part.reachSeries[index]?.newUsers ?? 0),
    returningUsers: sumBy(parts, (part) => part.reachSeries[index]?.returningUsers ?? 0),
  }));
}

const EMPTY_DEMOGRAPHICS: Demographics = { gender: [], ageBands: [], educationLevels: [], regions: [] };

function aggregateBuckets<TId extends string>(
  parts: readonly OverviewMetricsResponse[],
  pick: (demographics: Demographics) => readonly { id: TId; users: number }[]
): { id: TId; users: number }[] {
  const ids = pick(parts[0]?.demographics ?? EMPTY_DEMOGRAPHICS).map((bucket) => bucket.id);
  return ids.map((id) => ({
    id,
    users: sumBy(parts, (part) => pick(part.demographics).find((bucket) => bucket.id === id)?.users ?? 0),
  }));
}

/** The cross-institution view: sums for counts, weighted means for rates. */
export function aggregatePortfolio(
  institutions: readonly MockInstitution[],
  request: OverviewMetricsRequest
): OverviewMetricsResponse {
  const parts = institutions.map((institution) => metricsFor(institution, request));
  const total = sumBy(parts, (part) => part.cumulativeUsers.total);
  const reachSeries = aggregateReachSeries(parts);
  const activeCount = sumBy(parts, (part) => part.activeUsers.count);

  return {
    scope: { type: "portfolio", institutionCount: institutions.length },
    dateRange: request.dateRange,
    granularity: request.granularity,
    cumulativeUsers: {
      total,
      growthPercentage: growthPercentageOf(reachSeries),
      asOfPeriod: reachSeries[reachSeries.length - 1]?.period ?? request.dateRange.end,
    },
    activeUsers: {
      count: activeCount,
      shareOfUsersPercentage: total === 0 ? 0 : Math.round((activeCount / total) * 100),
      windowDays: ACTIVE_USERS_WINDOW_DAYS,
    },
    averageSessionMinutes: Math.round(weightedAverage(parts, (part) => part.averageSessionMinutes)),
    reachSeries,
    dailySeries: dailySeriesFor(total, request.dateRange.end),
    loginMethods: loginMethodsFor(total, request.loginMethod),
    averageLoginsPerUser: Math.round(weightedAverage(parts, (part) => part.averageLoginsPerUser) * 10) / 10,
    demographics: {
      gender: aggregateBuckets(parts, (demographics) => demographics.gender),
      ageBands: aggregateBuckets(parts, (demographics) => demographics.ageBands),
      educationLevels: aggregateBuckets(parts, (demographics) => demographics.educationLevels),
      regions: REGIONS.map((region) => ({
        ...region,
        users: sumBy(parts, (part) => part.demographics.regions.find((bucket) => bucket.id === region.id)?.users ?? 0),
      })),
    },
  };
}

/** The requested institutions, or all of them. An unknown id simply matches nothing. */
export function selectMockInstitutions(institutions: RequestedInstitutions): MockInstitution[] {
  if (institutions === "all") return [...MOCK_INSTITUTIONS];
  const requested = new Set(institutions);
  return MOCK_INSTITUTIONS.filter((institution) => requested.has(institution.id));
}

function selectInstitutions(request: OverviewMetricsRequest): MockInstitution[] {
  return selectMockInstitutions(request.institutions);
}

/** One institution in scope reports as itself; anything else reports as a portfolio. */
export function buildOverviewMetrics(request: OverviewMetricsRequest): OverviewMetricsResponse {
  const institutions = selectInstitutions(request);
  return institutions.length === 1 ? metricsFor(institutions[0], request) : aggregatePortfolio(institutions, request);
}

const GRANULARITIES: readonly Granularity[] = ["day", "week", "month"];

function asGranularity(value: string | null): Granularity {
  return GRANULARITIES.find((granularity) => granularity === value) ?? "month";
}

/** The server side of buildOverviewMetricsQuery() — kept here, next to the fixtures it feeds. */
export function parseOverviewMetricsQuery(params: URLSearchParams): OverviewMetricsRequest {
  const institutions = params.get("institutions") ?? "all";

  return {
    institutions: institutions === "all" ? "all" : institutions.split(",").filter(Boolean),
    dateRange: { start: params.get("start") ?? "", end: params.get("end") ?? "" },
    granularity: asGranularity(params.get("granularity")),
    audienceSegment: (params.get("audienceSegment") as AudienceSegmentId | null) ?? null,
    loginMethod: (params.get("loginMethod") as LoginMethodId | null) ?? null,
  };
}
