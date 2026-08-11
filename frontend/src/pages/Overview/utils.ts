/** Period keys sort chronologically as a string: `yyyy-MM` for a month, `yyyy-MM-dd` for a week or a day. */

import type { DateRange, Granularity } from "@/filters/filters";

/** A guard against a malformed range spanning centuries, not a product limit. */
const MAX_BUCKETS = 400;

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const DAY_MONTH_FORMATTER = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** UTC-based, so a DST shift inside the range can't move a bucket by a day. */
function toUtcDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toMonthKey(date: Date): string {
  return toIsoDate(date).slice(0, 7);
}

/** Every bucket the range covers, in order — a range starting mid-month still reports that whole month. */
export function listPeriods(range: DateRange, granularity: Granularity): string[] {
  const start = toUtcDate(range.start);
  const end = toUtcDate(range.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const periods: string[] = [];

  if (granularity === "month") {
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cursor <= end && periods.length < MAX_BUCKETS) {
      periods.push(toMonthKey(cursor));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return periods;
  }

  const step = granularity === "week" ? 7 : 1;
  const cursor = new Date(start);
  while (cursor <= end && periods.length < MAX_BUCKETS) {
    periods.push(toIsoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + step);
  }
  return periods;
}

/** `Jul '25` for a month bucket, `12 Jul` for a week or a day. */
export function formatPeriodLabel(period: string, granularity: Granularity): string {
  const date = toUtcDate(period);
  if (Number.isNaN(date.getTime())) return period;
  return granularity === "month" ? formatMonthYear(period) : DAY_MONTH_FORMATTER.format(date);
}

/** `Jul '25` — the short form used wherever a month stands in for a date. */
export function formatMonthYear(isoDate: string): string {
  const date = toUtcDate(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return `${MONTH_FORMATTER.format(date)} '${String(date.getUTCFullYear()).slice(-2)}`;
}

/** `Jul '25 – Jul '26`, or a single month when both ends fall inside it. */
export function formatDateRangeLabel(range: DateRange): string {
  const from = formatMonthYear(range.start);
  const to = formatMonthYear(range.end);
  return from === to ? from : `${from} – ${to}`;
}
