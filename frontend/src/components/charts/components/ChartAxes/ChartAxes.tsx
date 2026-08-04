import { CHART_GRID_COLOR } from "@/components/charts/chart-palette";
import { formatCompact, yAt, type ChartPlot } from "@/components/charts/chart-scale";

const uniqueId = "9f4d2e08-3b71-4c85-a1e6-d7c530b9f2a4";

export const DATA_TEST_ID = {
  GRID_CONTAINER: `chart-grid-container-${uniqueId}`,
  Y_TICK: `chart-y-tick-${uniqueId}`,
  X_LABEL: `chart-x-label-${uniqueId}`,
};

const AXIS_TEXT_CLASS = "fill-muted-foreground text-[11px] tabular-nums";

export interface ChartGridProps {
  ticks: readonly number[];
  max: number;
  plot: ChartPlot;
  formatTick?: (value: number) => string;
}

/** Horizontal gridlines with their value labels. Solid, never dashed — dashing reads as a threshold. */
export function ChartGrid({ ticks, max, plot, formatTick = formatCompact }: Readonly<ChartGridProps>) {
  return (
    <g data-slot="chart-grid" data-testid={DATA_TEST_ID.GRID_CONTAINER} aria-hidden="true">
      {ticks.map((tick) => {
        const y = yAt(tick, max, plot);
        return (
          <g key={tick}>
            <line x1={plot.left} y1={y} x2={plot.left + plot.width} y2={y} stroke={CHART_GRID_COLOR} strokeWidth={1} />
            <text
              data-testid={DATA_TEST_ID.Y_TICK}
              x={plot.left - 8}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              className={AXIS_TEXT_CLASS}
            >
              {formatTick(tick)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export interface ChartXLabelsProps {
  labels: readonly string[];
  plot: ChartPlot;
  /** Positions label `index` along the x axis. */
  xOf: (index: number) => number;
}

/**
 * Category labels under the plot, thinned at a stride rather than crowded or
 * rotated. The dropped ones stay in the tooltip and the data table.
 */
export function ChartXLabels({ labels, plot, xOf }: Readonly<ChartXLabelsProps>) {
  const stride = labelStride(labels, plot.width);
  const y = plot.top + plot.height + 18;

  return (
    <g data-slot="chart-x-labels" aria-hidden="true">
      {/* The last label always shows: an axis stopping short reads as truncated data. */}
      {labels.map((label, index) =>
        index % stride === 0 || index === labels.length - 1 ? (
          <text
            key={`${label}-${index}`}
            data-testid={DATA_TEST_ID.X_LABEL}
            x={xOf(index)}
            y={y}
            textAnchor="middle"
            className={AXIS_TEXT_CLASS}
          >
            {label}
          </text>
        ) : null
      )}
    </g>
  );
}

/** Roughly 56px of room per label before they start to collide. */
export function labelStride(labels: readonly unknown[], width: number): number {
  const affordable = Math.max(1, Math.floor(width / 56));
  return Math.max(1, Math.ceil(labels.length / affordable));
}
