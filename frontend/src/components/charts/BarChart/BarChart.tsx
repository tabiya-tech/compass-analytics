import { useTranslation } from "react-i18next";
import { Bar, CartesianGrid, BarChart as RechartsBarChart, XAxis, YAxis } from "recharts";
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
  EMPTY: "bar-chart-empty",
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

const MAX_BAR_WIDTH = 24;
const TOP_RADIUS: [number, number, number, number] = [4, 4, 0, 0];
const SQUARE_RADIUS: [number, number, number, number] = [0, 0, 0, 0];

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
  const isEmpty = categories.length === 0 || series.length === 0;
  const isStacked = stacked && series.length > 1;

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
      row[line.id] = line.values[index] ?? 0;
    }
    return row;
  });

  const chartConfig: ChartConfig = Object.fromEntries(
    series.map((line, index) => [line.id, { label: line.label, color: seriesColorAt(index) }])
  );

  // A stack is read against its total; the table has to carry that figure too.
  const columnTotals = categories.map((_, index) =>
    series.reduce((total, line) => total + (line.values[index] ?? 0), 0)
  );

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
    <div
      data-slot="bar-chart"
      className={cn("w-full transition-opacity duration-(--duration-base)", isLoading && "opacity-60", className)}
      aria-busy={isLoading || undefined}
    >
      <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height }}>
        <RechartsBarChart data={chartData} margin={{ left: 0, right: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="category" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={44} tickFormatter={valueFormatter} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
          {series.map((line, index) => (
            <Bar
              key={line.id}
              dataKey={line.id}
              name={line.label}
              stackId={isStacked ? "stack" : undefined}
              fill={seriesColorAt(index)}
              radius={isStacked ? (index === series.length - 1 ? TOP_RADIUS : SQUARE_RADIUS) : TOP_RADIUS}
              maxBarSize={MAX_BAR_WIDTH}
              isAnimationActive={false}
            />
          ))}
        </RechartsBarChart>
      </ChartContainer>
      <ChartDataTable table={table} />
    </div>
  );
}
