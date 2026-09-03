// Charts color marks from data, so the color has to be an SVG fill/stroke
// value rather than a Tailwind class. `var(--chart-N)` works in both, keeping
// the source of truth in index.css with every other design token.

const CHART_SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"] as const;

/** The unfilled remainder of a bar's track — the "not yet" band, shared by every progress bar. */
export const CHART_TRACK_COLOR = "var(--surface-wash)";

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

/**
 * A funnel's stages are the same metric shedding people at each step, not
 * separate series, so they share one ramp that darkens as the funnel narrows.
 * Every stop carries white ink; only the lightest fill holds it below AA.
 */
const INK_ON_DARK = "var(--chart-funnel-ink-on-dark)";

const CHART_FUNNEL_STOPS = [
  { fill: "var(--chart-funnel-1)", ink: INK_ON_DARK },
  { fill: "var(--chart-funnel-2)", ink: INK_ON_DARK },
  { fill: "var(--chart-funnel-3)", ink: INK_ON_DARK },
  { fill: "var(--chart-funnel-4)", ink: INK_ON_DARK },
] as const;

export interface FunnelStop {
  fill: string;
  ink: string;
}

/** Stage `index` of a `count`-stage funnel, sampled across the whole ramp so a short funnel still runs light to dark. */
export function funnelStopAt(index: number, count: number): FunnelStop {
  if (count <= 1) return CHART_FUNNEL_STOPS[0];
  const position = Math.min(Math.max(index, 0), count - 1) / (count - 1);
  return CHART_FUNNEL_STOPS[Math.round(position * (CHART_FUNNEL_STOPS.length - 1))];
}
