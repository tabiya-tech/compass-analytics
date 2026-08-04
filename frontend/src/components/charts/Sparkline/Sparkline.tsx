import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { CHART_SURFACE_COLOR, seriesColorAt } from "@/components/charts/chart-palette";
import {
  areaPath,
  formatNumber,
  linePath,
  plotFrom,
  xAt,
  yAt,
  type ChartMargin,
} from "@/components/charts/chart-scale";

const uniqueId = "7d3c0b95-1af8-4e62-b47d-8c2091e5a6f3";

export const DATA_TEST_ID = {
  CONTAINER: `sparkline-container-${uniqueId}`,
  LINE: `sparkline-line-${uniqueId}`,
  AREA: `sparkline-area-${uniqueId}`,
  END_MARKER: `sparkline-end-marker-${uniqueId}`,
};

export interface SparklineProps {
  values: readonly number[];
  label?: string;
  width?: number;
  height?: number;
  color?: string;
  filled?: boolean;
  showEndMarker?: boolean;
  valueFormatter?: (value: number) => string;
  className?: string;
}

const MARGIN: ChartMargin = { top: 5, right: 6, bottom: 5, left: 1 };

const DIRECTION_LABEL_KEYS = {
  up: "charts.sparkline.up",
  down: "charts.sparkline.down",
  flat: "charts.sparkline.flat",
} as const;

export function Sparkline({
  values,
  label,
  width = 80,
  height = 24,
  color = seriesColorAt(0),
  filled = false,
  showEndMarker = false,
  valueFormatter = formatNumber,
  className,
}: Readonly<SparklineProps>) {
  const { t } = useTranslation();

  // A single point has no shape to draw or describe.
  if (values.length < 2) return null;

  const plot = plotFrom(width, height, MARGIN);
  // Scaled to the data's own maximum — no ticks here, so a round top would only flatten the shape.
  const max = Math.max(...values) || 1;
  const first = values[0];
  const last = values[values.length - 1];

  const direction = last > first ? "up" : last < first ? "down" : "flat";
  const accessibleLabel =
    label ?? t(DIRECTION_LABEL_KEYS[direction], { from: valueFormatter(first), to: valueFormatter(last) });

  return (
    <svg
      data-slot="sparkline"
      data-testid={DATA_TEST_ID.CONTAINER}
      role="img"
      aria-label={accessibleLabel}
      data-direction={direction}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("block overflow-visible", className)}
    >
      {filled && (
        <path data-testid={DATA_TEST_ID.AREA} d={areaPath(values, max, plot)} fill={color} fillOpacity={0.1} />
      )}
      <path
        data-testid={DATA_TEST_ID.LINE}
        d={linePath(values, max, plot)}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showEndMarker && (
        <circle
          data-testid={DATA_TEST_ID.END_MARKER}
          cx={xAt(values.length - 1, values.length, plot)}
          cy={yAt(last, max, plot)}
          r={3}
          fill={color}
          stroke={CHART_SURFACE_COLOR}
          strokeWidth={2}
        />
      )}
    </svg>
  );
}
