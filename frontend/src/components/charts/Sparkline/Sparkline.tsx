import { useTranslation } from "react-i18next";
import { LineChart, type LineChartSeries } from "@/components/charts/LineChart";
import { seriesColorAt } from "@/components/charts/chart-palette";
import { formatNumber } from "@/components/charts/chart-scale";
import { cn } from "@/lib/utils";

export const DATA_TEST_ID = {
  CONTAINER: "sparkline-container",
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

  const first = values[0];
  const last = values[values.length - 1];
  const direction = last > first ? "up" : last < first ? "down" : "flat";
  const accessibleLabel =
    label ?? t(DIRECTION_LABEL_KEYS[direction], { from: valueFormatter(first), to: valueFormatter(last) });

  const series: readonly LineChartSeries[] = [
    {
      id: "sparkline",
      label: accessibleLabel,
      points: values.map((value, index) => ({ label: String(index), value })),
      color,
    },
  ];

  return (
    <div
      data-slot="sparkline"
      data-testid={DATA_TEST_ID.CONTAINER}
      role="img"
      aria-label={accessibleLabel}
      data-direction={direction}
      className={cn("inline-block shrink-0", className)}
      style={{ width, height }}
    >
      <LineChart
        label={accessibleLabel}
        series={series}
        filled={filled}
        height={height}
        valueFormatter={valueFormatter}
        showEndMarker={showEndMarker}
        hideAxes
        hideGrid
        hideTooltip
        hideLegend
        hideTable
      />
    </div>
  );
}
