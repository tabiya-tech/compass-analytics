/** Number formatting shared by every chart. */

/** Thousands-separated, for values read in full. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value);
}

export function percentageOf(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

/** Converts a number of minutes into a string like "12.3m" or "1.2h", rounded to one decimal place. */
export function formatMinutesDuration(totalMinutes: number): string {
  return totalMinutes < 60 ? `${totalMinutes.toFixed(1)}m` : `${(totalMinutes / 60).toFixed(1)}h`;
}
