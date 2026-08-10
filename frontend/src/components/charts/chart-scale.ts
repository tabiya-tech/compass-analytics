/** Number formatting shared by every chart. */

/** Thousands-separated, for values read in full. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value);
}

export function percentageOf(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}
