import type { TranslationKey } from "@/i18n/react-i18next";

export type Granularity = "day" | "week" | "month";

/** Inclusive calendar dates, yyyy-MM-dd. */
export interface DateRange {
  start: string;
  end: string;
}

export const AUDIENCE_SEGMENT_LABEL_KEYS = {
  youth: "filters.audienceSegments.youth",
  women: "filters.audienceSegments.women",
  rural: "filters.audienceSegments.rural",
  "first-time-jobseeker": "filters.audienceSegments.firstTimeJobseeker",
} as const satisfies Record<string, TranslationKey>;

export const LOGIN_METHOD_LABEL_KEYS = {
  email: "filters.loginMethods.email",
  google: "filters.loginMethods.google",
  anonymous: "filters.loginMethods.anonymous",
} as const satisfies Record<string, TranslationKey>;

export type AudienceSegmentId = keyof typeof AUDIENCE_SEGMENT_LABEL_KEYS;
export type LoginMethodId = keyof typeof LOGIN_METHOD_LABEL_KEYS;

export interface FiltersState {
  dateRange: DateRange;
  granularity: Granularity; // derived from dateRange, never set directly
  audienceSegment: AudienceSegmentId | null;
  loginMethod: LoginMethodId | null;
  institutionDrillDownId: string | null;
}

export type ChipFilterKey = "institutionDrillDownId" | "audienceSegment" | "loginMethod";

export type FiltersPatch = Partial<Pick<FiltersState, "dateRange" | ChipFilterKey>>;

const DAY_MAX_SPAN_DAYS = 45;
const WEEK_MAX_SPAN_DAYS = 200;
const DEFAULT_RANGE_SPAN_DAYS = 30;

function toUtcDayIndex(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / (24 * 60 * 60 * 1000);
}

/** Whole days, end − start. UTC-based so a DST shift inside the range can't skew it. */
export function spanInDays(start: string, end: string): number {
  return toUtcDayIndex(end) - toUtcDayIndex(start);
}

/** ≤45 days → "day", ≤200 → "week", else "month". Uses the absolute span, so start/end order is irrelevant. */
export function deriveGranularity(range: DateRange): Granularity {
  const span = Math.abs(spanInDays(range.start, range.end));
  if (span <= DAY_MAX_SPAN_DAYS) return "day";
  if (span <= WEEK_MAX_SPAN_DAYS) return "week";
  return "month";
}

/** Local fields, not toISOString() — that shifts the date by a day outside UTC. */
function toIsoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Last 30 days ending `today`. `today` is injectable for tests. */
export function createInitialFilters(today: Date = new Date()): FiltersState {
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - DEFAULT_RANGE_SPAN_DAYS);
  const dateRange: DateRange = { start: toIsoDate(startDate), end: toIsoDate(today) };

  return {
    dateRange,
    granularity: deriveGranularity(dateRange),
    audienceSegment: null,
    loginMethod: null,
    institutionDrillDownId: null,
  };
}

/** The chip filters that currently have a value, in the order they should render. */
export function getActiveFilters(state: FiltersState): { key: ChipFilterKey; value: string }[] {
  const keys: ChipFilterKey[] = ["institutionDrillDownId", "audienceSegment", "loginMethod"];
  return keys.filter((key) => state[key] !== null).map((key) => ({ key, value: state[key] as string }));
}
