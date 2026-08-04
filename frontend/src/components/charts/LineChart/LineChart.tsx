import { useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { ChartGrid, ChartXLabels } from "@/components/charts/components/ChartAxes";
import { ChartFrame, type ChartTable } from "@/components/charts/components/ChartFrame";
import { ChartLegend } from "@/components/charts/components/ChartLegend";
import { ChartTooltip } from "@/components/charts/components/ChartTooltip";
import { CHART_GRID_COLOR, CHART_SURFACE_COLOR, seriesColorAt } from "@/components/charts/chart-palette";
import {
  areaPath,
  axisMax,
  formatNumber,
  linePath,
  nearestIndex,
  niceTicks,
  plotFrom,
  xAt,
  yAt,
  type ChartMargin,
} from "@/components/charts/chart-scale";

const uniqueId = "c81f5a37-2e94-4b0d-96a3-fa7b28e4c105";

export const DATA_TEST_ID = {
  LINE: `line-chart-line-${uniqueId}`,
  AREA: `line-chart-area-${uniqueId}`,
  CROSSHAIR: `line-chart-crosshair-${uniqueId}`,
  MARKER: `line-chart-marker-${uniqueId}`,
};

export interface LineChartPoint {
  /** The x-axis label for this position. */
  label: string;
  value: number;
}

export interface LineChartSeries {
  id: string;
  label: string;
  points: readonly LineChartPoint[];
}

export interface LineChartProps {
  label: string;
  series: readonly LineChartSeries[];
  filled?: boolean;
  height?: number;
  isLoading?: boolean;
  emptyMessage?: string;
  categoryLabel?: string;
  valueFormatter?: (value: number) => string;
  className?: string;
}

const MARGIN: ChartMargin = { top: 12, right: 12, bottom: 28, left: 44 };

export function LineChart({
  label,
  series,
  filled = false,
  height = 240,
  isLoading = false,
  emptyMessage,
  categoryLabel,
  valueFormatter = formatNumber,
  className,
}: Readonly<LineChartProps>) {
  const { t } = useTranslation();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  const categories = series[0]?.points.map((point) => point.label) ?? [];
  const isEmpty = categories.length === 0 || series.every((line) => line.points.length === 0);
  const max = axisMax(Math.max(0, ...series.flatMap((line) => line.points.map((point) => point.value))));
  const ticks = niceTicks(max);

  const table: ChartTable = {
    caption: label,
    columns: [categoryLabel ?? t("charts.table.period"), ...series.map((line) => line.label)],
    rows: categories.map((category, index) => ({
      header: category,
      cells: series.map((line) => valueFormatter(line.points[index]?.value ?? 0)),
    })),
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    setPointer({ x, y: event.clientY - bounds.top });
    setHoveredIndex(nearestIndex(x, plotFrom(bounds.width, height, MARGIN), categories.length));
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
      svgProps={{ onPointerMove: handlePointerMove, onPointerLeave: () => setHoveredIndex(null) }}
      footer={
        series.length > 1 ? (
          <ChartLegend
            markShape="line"
            items={series.map((line, index) => ({ id: line.id, label: line.label, color: seriesColorAt(index) }))}
          />
        ) : null
      }
      overlay={(width) =>
        hoveredIndex !== null && (
          <ChartTooltip
            title={categories[hoveredIndex]}
            x={pointer.x}
            y={pointer.y}
            containerWidth={width}
            rows={series.map((line, index) => ({
              label: line.label,
              value: valueFormatter(line.points[hoveredIndex]?.value ?? 0),
              color: seriesColorAt(index),
            }))}
          />
        )
      }
    >
      {(width) => {
        const plot = plotFrom(width, height, MARGIN);
        const hoverX = hoveredIndex !== null ? xAt(hoveredIndex, categories.length, plot) : 0;

        return (
          <>
            <ChartGrid ticks={ticks} max={max} plot={plot} />
            <ChartXLabels labels={categories} plot={plot} xOf={(index) => xAt(index, categories.length, plot)} />

            {series.map((line, index) => {
              const values = line.points.map((point) => point.value);
              const color = seriesColorAt(index);
              return (
                <g key={line.id}>
                  {filled && (
                    <path
                      data-testid={DATA_TEST_ID.AREA}
                      d={areaPath(values, max, plot)}
                      fill={color}
                      fillOpacity={0.1}
                    />
                  )}
                  <path
                    data-testid={DATA_TEST_ID.LINE}
                    data-series={line.id}
                    d={linePath(values, max, plot)}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}

            {hoveredIndex !== null && (
              <g>
                <line
                  data-testid={DATA_TEST_ID.CROSSHAIR}
                  x1={hoverX}
                  y1={plot.top}
                  x2={hoverX}
                  y2={plot.top + plot.height}
                  stroke={CHART_GRID_COLOR}
                  strokeWidth={1}
                />
                {series.map((line, index) => {
                  const point = line.points[hoveredIndex];
                  if (!point) return null;
                  return (
                    <circle
                      key={line.id}
                      data-testid={DATA_TEST_ID.MARKER}
                      cx={hoverX}
                      cy={yAt(point.value, max, plot)}
                      r={4}
                      fill={seriesColorAt(index)}
                      stroke={CHART_SURFACE_COLOR}
                      strokeWidth={2}
                    />
                  );
                })}
              </g>
            )}
          </>
        );
      }}
    </ChartFrame>
  );
}
