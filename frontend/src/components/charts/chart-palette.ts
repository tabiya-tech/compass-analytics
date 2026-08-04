// Charts color marks from data, so the color has to be an SVG fill/stroke
// value rather than a Tailwind class. `var(--chart-N)` works in both, keeping
// the source of truth in index.css with every other design token.

const CHART_SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"] as const;

/** Marks a threshold, never a series. */
export const CHART_TARGET_COLOR = "var(--chart-warning)";

export const CHART_GRID_COLOR = "var(--chart-grid)";

/** Draws the 2px gaps between touching marks, so it must match the card behind the chart. */
export const CHART_SURFACE_COLOR = "var(--chart-surface)";

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
