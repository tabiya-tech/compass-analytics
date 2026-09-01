import { useTranslation } from "react-i18next";
import { Bar, BarChart as RechartsBarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/shared/EmptyState";
import { ChartDataTable, type ChartTable } from "@/components/charts/components/ChartDataTable";
import { CHART_TARGET_COLOR, seriesColorAt } from "@/components/charts/chart-palette";
import { formatNumber } from "@/components/charts/chart-scale";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export const DATA_TEST_ID = {
  EMPTY: "histogram-empty",
};

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
}

export interface HistogramProps {
  label: string;
  bins: readonly HistogramBin[];
  target?: number;
  targetLabel?: string;
  countLabel?: string;
  height?: number;
  isLoading?: boolean;
  emptyMessage?: string;
  boundFormatter?: (value: number) => string;
  countFormatter?: (value: number) => string;
  className?: string;
}

function nearestBin(bins: readonly HistogramBin[], target: number): HistogramBin {
  const containing = bins.find((bin) => target >= bin.from && target < bin.to);
  if (containing) return containing;

  return bins.reduce((closest, bin) => {
    const distanceTo = (candidate: HistogramBin) =>
      Math.min(Math.abs(candidate.from - target), Math.abs(candidate.to - target));
    return distanceTo(bin) < distanceTo(closest) ? bin : closest;
  }, bins[0]);
}

export function Histogram({
  label,
  bins,
  target,
  targetLabel,
  countLabel,
  height = 220,
  isLoading = false,
  emptyMessage,
  boundFormatter = formatNumber,
  countFormatter = formatNumber,
  className,
}: Readonly<HistogramProps>) {
  const { t } = useTranslation();
  const isEmpty = bins.length === 0;

  if (isEmpty) {
    return (
      <div data-testid={DATA_TEST_ID.EMPTY} className={cn("w-full", className)} style={{ minHeight: height }}>
        <EmptyState message={isLoading ? t("common.loading") : (emptyMessage ?? t("charts.empty"))} />
      </div>
    );
  }

  const chartData = bins.map((bin) => ({
    ...bin,
    rangeLabel: t("charts.histogram.range", { from: boundFormatter(bin.from), to: boundFormatter(bin.to) }),
  }));

  const resolvedCountLabel = countLabel ?? t("charts.table.count");

  const chartConfig: ChartConfig = {
    count: { label: resolvedCountLabel, color: seriesColorAt(0) },
  };

  const table: ChartTable = {
    caption: label,
    columns: [t("charts.table.range"), t("charts.table.count")],
    rows: chartData.map((bin) => ({ header: bin.rangeLabel, cells: [countFormatter(bin.count)] })),
  };

  // The axis is categorical (one tick per bin), so the marker sits on the
  // nearest bin's category rather than at an interpolated pixel position.
  const targetBin = target != null ? nearestBin(bins, target) : undefined;
  const targetRangeLabel = targetBin
    ? t("charts.histogram.range", { from: boundFormatter(targetBin.from), to: boundFormatter(targetBin.to) })
    : undefined;

  return (
    <div
      data-slot="histogram"
      className={cn("w-full transition-opacity duration-(--duration-base)", isLoading && "opacity-60", className)}
      aria-busy={isLoading || undefined}
    >
      <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height }}>
        <RechartsBarChart data={chartData} margin={{ left: 0, right: 0, top: targetLabel ? 20 : 4 }} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="rangeLabel" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={44} tickFormatter={countFormatter} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, _name, item) => (
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="text-primary-foreground/70">{item.payload?.rangeLabel as string}</span>
                    <span className="font-mono font-medium tabular-nums text-primary-foreground">
                      {countFormatter(Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar
            dataKey="count"
            name={resolvedCountLabel}
            fill={seriesColorAt(0)}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
          {targetRangeLabel && (
            <ReferenceLine
              x={targetRangeLabel}
              stroke={CHART_TARGET_COLOR}
              strokeDasharray="4 3"
              label={
                targetLabel
                  ? { value: targetLabel, position: "top", fill: "var(--muted-foreground)", fontSize: 11 }
                  : undefined
              }
            />
          )}
        </RechartsBarChart>
      </ChartContainer>
      <ChartDataTable table={table} />
    </div>
  );
}
