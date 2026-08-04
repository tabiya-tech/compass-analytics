/** Geometry and number formatting shared by every chart. */

export interface ChartPlot {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** The area left to draw in, once the axis gutters are taken out. */
export function plotFrom(width: number, height: number, margin: ChartMargin): ChartPlot {
  return {
    left: margin.left,
    top: margin.top,
    // Never negative: a container smaller than its own gutters would otherwise
    // draw marks inside out.
    width: Math.max(0, width - margin.left - margin.right),
    height: Math.max(0, height - margin.top - margin.bottom),
  };
}

/** Ticks from 0 to at least `max`, on 1/2/5 steps so they read as round numbers. */
export function niceTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0 || count < 1) return [0];

  const rawStep = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceStep = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;

  const ticks: number[] = [];
  for (let tick = 0; tick < max + niceStep; tick += niceStep) {
    // Multiplied, not accumulated, so labels don't drift into 0.30000000000000004.
    ticks.push(Number((ticks.length * niceStep).toPrecision(12)));
  }
  return ticks;
}

/** The first round tick at or above `max`. */
export function axisMax(max: number, count = 4): number {
  const ticks = niceTicks(max, count);
  return ticks[ticks.length - 1] || 1;
}

/** 1,284 / 12.9K / 4.2M — for ticks and tight labels. */
export function formatCompact(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000) return `${trimZero(value / 1_000_000)}M`;
  if (magnitude >= 10_000) return `${trimZero(value / 1_000)}K`;
  return formatNumber(value);
}

/** Thousands-separated, for values read in full. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value);
}

function trimZero(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

export function percentageOf(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

/** The data point closest to `x` — what the crosshair snaps to. */
export function nearestIndex(x: number, plot: ChartPlot, count: number): number {
  if (count <= 1) return 0;
  const ratio = (x - plot.left) / plot.width;
  return Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))));
}

/** The x center of band `index`, when `count` bands share the plot's width. */
export function bandCenter(index: number, count: number, plot: ChartPlot): number {
  if (count <= 0) return plot.left;
  const band = plot.width / count;
  return plot.left + band * index + band / 2;
}

export function linePath(values: readonly number[], max: number, plot: ChartPlot): string {
  return values
    .map((value, index) => `${index === 0 ? "M" : "L"}${pointAt(values, index, value, max, plot)}`)
    .join(" ");
}

/** The same line, closed down to the baseline to fill the area under it. */
export function areaPath(values: readonly number[], max: number, plot: ChartPlot): string {
  if (values.length === 0) return "";
  const baseline = plot.top + plot.height;
  const first = xAt(0, values.length, plot);
  const last = xAt(values.length - 1, values.length, plot);
  return `${linePath(values, max, plot)} L${last},${baseline} L${first},${baseline} Z`;
}

export function xAt(index: number, count: number, plot: ChartPlot): number {
  if (count <= 1) return plot.left + plot.width / 2;
  return plot.left + (index / (count - 1)) * plot.width;
}

export function yAt(value: number, max: number, plot: ChartPlot): number {
  if (max <= 0) return plot.top + plot.height;
  return plot.top + plot.height * (1 - value / max);
}

/** A rect rounded on top only. The radius shrinks to fit short or narrow marks. */
export function topRoundedRectPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, height, width / 2));
  const bottom = y + height;
  return [
    `M${x},${bottom}`,
    `L${x},${y + r}`,
    r > 0 ? `Q${x},${y} ${x + r},${y}` : "",
    `L${x + width - r},${y}`,
    r > 0 ? `Q${x + width},${y} ${x + width},${y + r}` : "",
    `L${x + width},${bottom}`,
    "Z",
  ]
    .filter(Boolean)
    .join(" ");
}

function pointAt(values: readonly number[], index: number, value: number, max: number, plot: ChartPlot): string {
  return `${round(xAt(index, values.length, plot))},${round(yAt(value, max, plot))}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
