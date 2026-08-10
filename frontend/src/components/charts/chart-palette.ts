// Charts color marks from data, so the color has to be an SVG fill/stroke
// value rather than a Tailwind class. `var(--chart-N)` works in both, keeping
// the source of truth in index.css with every other design token.

const CHART_SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"] as const;

/** Marks a threshold — a histogram's target line, a gauge's off-track state — never a data series. */
export const CHART_TARGET_COLOR = "var(--chart-warning)";

/** A single progress metric shown in two stages (e.g. completed vs. started) — not a pass/fail state, so it stays green rather than turning amber. */
export const CHART_PROGRESS_DONE_COLOR = "var(--chart-progress-done)";
export const CHART_PROGRESS_ACTIVE_COLOR = "var(--chart-progress-active)";

/**
 * The color for a series at `index`, in fixed assignment order — index by a
 * stable series identity, never by the row's current rank.
 *
 * Past the fourth slot the palette stops: a fifth generated hue would be
 * indistinguishable under color-vision deficiency. Fold the tail into an
 * "Other" series upstream rather than relying on the wrap.
 */
export function seriesColorAt(index: number): string {
  return CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length];
}
