import { useTranslation } from "react-i18next";
import { Area, AreaChart as RechartsAreaChart, CartesianGrid, ReferenceDot, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/shared/EmptyState";
import { ChartDataTable, type ChartTable } from "@/components/charts/components/ChartDataTable";
import { seriesColorAt } from "@/components/charts/chart-palette";
import { formatNumber } from "@/components/charts/chart-scale";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export const DATA_TEST_ID = {
  EMPTY: "line-chart-empty",
};

export interface LineChartPoint {
  label: string;
  value: number;
}

export interface LineChartSeries {
  id: string;
  label: string;
  points: readonly LineChartPoint[];
  color?: string;
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
  showEndMarker?: boolean;
  hideAxes?: boolean;
  hideGrid?: boolean;
  hideTooltip?: boolean;
  hideLegend?: boolean;
  hideTable?: boolean;
}

const DEFAULT_MARGIN = { left: 0, right: 0 };
const HIDDEN_AXES_MARGIN = { top: 4, right: 4, bottom: 4, left: 4 };

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
  showEndMarker = false,
  hideAxes = false,
  hideGrid = false,
  hideTooltip = false,
  hideLegend = false,
  hideTable = false,
}: Readonly<LineChartProps>) {
  const { t } = useTranslation();
  const categories = series[0]?.points.map((point) => point.label) ?? [];
  const isEmpty = categories.length === 0 || series.every((line) => line.points.length === 0);

  if (isEmpty) {
    return (
      <div data-testid={DATA_TEST_ID.EMPTY} className={cn("w-full", className)} style={{ minHeight: height }}>
        <EmptyState message={isLoading ? t("common.loading") : (emptyMessage ?? t("charts.empty"))} />
      </div>
    );
  }

  const chartData = categories.map((category, index) => {
    const row: Record<string, string | number> = { category };
    for (const line of series) {
      row[line.id] = line.points[index]?.value ?? 0;
    }
    return row;
  });

  const chartConfig: ChartConfig = Object.fromEntries(
    series.map((line, index) => [line.id, { label: line.label, color: line.color ?? seriesColorAt(index) }])
  );

  const table: ChartTable = {
    caption: label,
    columns: [categoryLabel ?? t("charts.table.period"), ...series.map((line) => line.label)],
    rows: categories.map((category, index) => ({
      header: category,
      cells: series.map((line) => valueFormatter(line.points[index]?.value ?? 0)),
    })),
  };

  const lastCategory = categories[categories.length - 1];

  return (
    <div
      data-slot="line-chart"
      className={cn("w-full transition-opacity duration-(--duration-base)", isLoading && "opacity-60", className)}
      aria-busy={isLoading || undefined}
    >
      <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height }}>
        <RechartsAreaChart data={chartData} margin={hideAxes ? HIDDEN_AXES_MARGIN : DEFAULT_MARGIN} accessibilityLayer>
          {!hideGrid && <CartesianGrid vertical={false} />}
          <XAxis dataKey="category" tickLine={false} axisLine={false} hide={hideAxes} />
          <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={valueFormatter} hide={hideAxes} />
          {!hideTooltip && <ChartTooltip content={<ChartTooltipContent />} cursor={{ stroke: "var(--border)" }} />}
          {!hideLegend && series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
          {series.map((line, index) => {
            const color = line.color ?? seriesColorAt(index);
            return (
              <Area
                key={line.id}
                dataKey={line.id}
                name={line.label}
                type="monotone"
                stroke={color}
                fill={color}
                fillOpacity={filled ? 0.1 : 0}
                strokeWidth={2}
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4 }}
              />
            );
          })}
          {showEndMarker &&
            lastCategory !== undefined &&
            series.map((line, index) => {
              const lastPoint = line.points[line.points.length - 1];
              if (!lastPoint) return null;
              const color = line.color ?? seriesColorAt(index);
              return (
                <ReferenceDot
                  key={line.id}
                  x={lastCategory}
                  y={lastPoint.value}
                  r={3}
                  fill={color}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              );
            })}
        </RechartsAreaChart>
      </ChartContainer>
      {!hideTable && <ChartDataTable table={table} />}
    </div>
  );
}
