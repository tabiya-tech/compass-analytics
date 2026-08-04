import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChartGrid, ChartXLabels } from "@/components/charts/components/ChartAxes";
import { ChartFrame, type ChartTable } from "@/components/charts/components/ChartFrame";
import { ChartLegend } from "@/components/charts/components/ChartLegend";
import { ChartTooltip } from "@/components/charts/components/ChartTooltip";
import { seriesColorAt } from "@/components/charts/chart-palette";
import {
  axisMax,
  bandCenter,
  formatNumber,
  niceTicks,
  plotFrom,
  topRoundedRectPath,
  type ChartMargin,
} from "@/components/charts/chart-scale";

const uniqueId = "e5a72c31-8b04-4f9d-a1c6-3d90b7e284fa";

export const DATA_TEST_ID = {
  BAND: `bar-chart-band-${uniqueId}`,
  BAR: `bar-chart-bar-${uniqueId}`,
};

export interface BarChartSeries {
  id: string;
  label: string;
  values: readonly number[];
}

export interface BarChartProps {
  label: string;
  categories: readonly string[];
  series: readonly BarChartSeries[];
  stacked?: boolean;
  height?: number;
  isLoading?: boolean;
  emptyMessage?: string;
  categoryLabel?: string;
  valueFormatter?: (value: number) => string;
  className?: string;
}

const MARGIN: ChartMargin = { top: 12, right: 12, bottom: 28, left: 44 };
/** Capped rather than filling the band — the leftover is deliberate air. */
const MAX_BAR_WIDTH = 24;
const BAND_PADDING = 0.3;
const GAP = 2;
const CORNER_RADIUS = 4;

export function BarChart({
  label,
  categories,
  series,
  stacked = false,
  height = 240,
  isLoading = false,
  emptyMessage,
  categoryLabel,
  valueFormatter = formatNumber,
  className,
}: Readonly<BarChartProps>) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<{ index: number; x: number; y: number } | null>(null);

  const isEmpty = categories.length === 0 || series.length === 0;
  const isStacked = stacked && series.length > 1;

  // A stack is read against its total; grouped bars against the tallest single bar.
  const columnTotals = categories.map((_, index) =>
    series.reduce((total, line) => total + (line.values[index] ?? 0), 0)
  );
  const peak = isStacked ? Math.max(0, ...columnTotals) : Math.max(0, ...series.flatMap((line) => line.values));
  const max = axisMax(peak);
  const ticks = niceTicks(peak);

  const table: ChartTable = {
    caption: label,
    columns: [
      categoryLabel ?? t("charts.table.period"),
      ...series.map((line) => line.label),
      ...(isStacked ? [t("charts.table.total")] : []),
    ],
    rows: categories.map((category, index) => ({
      header: category,
      cells: [
        ...series.map((line) => valueFormatter(line.values[index] ?? 0)),
        ...(isStacked ? [valueFormatter(columnTotals[index])] : []),
      ],
    })),
  };

  return (
    <ChartFrame
      label={label}
      height={height}
      table={table}
      isEmpty={isEmpty}
      isLoading={isLoading}
      emptyMessage={emptyMessage}
      className={className}
      footer={
        series.length > 1 ? (
          <ChartLegend
            items={series.map((line, index) => ({ id: line.id, label: line.label, color: seriesColorAt(index) }))}
          />
        ) : null
      }
      overlay={(width) =>
        hovered && (
          <ChartTooltip
            title={categories[hovered.index]}
            x={hovered.x}
            y={hovered.y}
            containerWidth={width}
            rows={series.map((line, index) => ({
              label: line.label,
              value: valueFormatter(line.values[hovered.index] ?? 0),
              color: seriesColorAt(index),
            }))}
          />
        )
      }
    >
      {(width) => {
        const plot = plotFrom(width, height, MARGIN);
        const bandWidth = plot.width / categories.length;
        const slotWidth = Math.min(MAX_BAR_WIDTH, bandWidth * (1 - BAND_PADDING));
        // Grouped series split the slot between them, each keeping the gap.
        const barWidth = isStacked || series.length === 1 ? slotWidth : Math.max(2, slotWidth / series.length - GAP);

        return (
          <>
            <ChartGrid ticks={ticks} max={max} plot={plot} />
            <ChartXLabels labels={categories} plot={plot} xOf={(index) => bandCenter(index, categories.length, plot)} />

            {categories.map((category, index) => {
              const center = bandCenter(index, categories.length, plot);
              const baseline = plot.top + plot.height;
              let stackTop = baseline;

              return (
                <g key={`${category}-${index}`}>
                  {/* Full-height band, so a short bar is still easy to hit. */}
                  <rect
                    data-testid={DATA_TEST_ID.BAND}
                    x={center - bandWidth / 2}
                    y={plot.top}
                    width={bandWidth}
                    height={plot.height}
                    fill="transparent"
                    onPointerMove={(event) => {
                      const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                      if (!bounds) return;
                      setHovered({ index, x: event.clientX - bounds.left, y: event.clientY - bounds.top });
                    }}
                    onPointerLeave={() => setHovered(null)}
                  />
                  {series.map((line, seriesIndex) => {
                    const value = line.values[index] ?? 0;
                    const barHeight = max > 0 ? (value / max) * plot.height : 0;
                    if (barHeight <= 0) return null;

                    const x = isStacked
                      ? center - barWidth / 2
                      : center - slotWidth / 2 + seriesIndex * (barWidth + GAP);

                    // Segments are separated by the 2px surface gap, not a stroke.
                    const y = isStacked ? stackTop - barHeight : baseline - barHeight;
                    const drawnHeight = isStacked && seriesIndex > 0 ? Math.max(0, barHeight - GAP) : barHeight;
                    if (isStacked) stackTop -= barHeight;

                    // Only the column's top is rounded; bars stay square at the baseline.
                    const isTop = !isStacked || seriesIndex === series.length - 1;

                    return (
                      <path
                        key={line.id}
                        data-testid={DATA_TEST_ID.BAR}
                        data-series={line.id}
                        d={topRoundedRectPath(x, y, barWidth, drawnHeight, isTop ? CORNER_RADIUS : 0)}
                        fill={seriesColorAt(seriesIndex)}
                        className="pointer-events-none"
                      />
                    );
                  })}
                </g>
              );
            })}
          </>
        );
      }}
    </ChartFrame>
  );
}
