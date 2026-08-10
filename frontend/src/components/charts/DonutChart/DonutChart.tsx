import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart } from "recharts";
import { EmptyState } from "@/components/shared/EmptyState";
import { ChartDataTable, type ChartTable } from "@/components/charts/components/ChartDataTable";
import { ChartLegend } from "@/components/charts/DonutChart/components/ChartLegend";
import { seriesColorAt } from "@/components/charts/chart-palette";
import { formatNumber, percentageOf } from "@/components/charts/chart-scale";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export const DATA_TEST_ID = {
  CENTER_LABEL: "donut-chart-center-label",
  EMPTY: "donut-chart-empty",
};

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  color?: string;
}

export interface DonutChartProps {
  label: string;
  slices: readonly DonutSlice[];
  centerLabel?: ReactNode;
  centerCaption?: string;
  onSelect?: (id: string | null) => void;
  selectedId?: string | null;
  size?: number;
  emptyMessage?: string;
  valueFormatter?: (value: number) => string;
  className?: string;
}

const THICKNESS = 26;

export function DonutChart({
  label,
  slices,
  centerLabel,
  centerCaption,
  onSelect,
  selectedId,
  size = 180,
  emptyMessage,
  valueFormatter = formatNumber,
  className,
}: Readonly<DonutChartProps>) {
  const { t } = useTranslation();
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const isInteractive = Boolean(onSelect);

  if (slices.length === 0 || total <= 0) {
    return (
      <div data-testid={DATA_TEST_ID.EMPTY} className={className}>
        <EmptyState message={emptyMessage ?? t("charts.empty")} />
      </div>
    );
  }

  const table: ChartTable = {
    caption: label,
    columns: [t("charts.table.category"), t("charts.table.value"), t("charts.table.share")],
    rows: slices.map((slice) => ({
      header: slice.label,
      cells: [valueFormatter(slice.value), `${percentageOf(slice.value, total)}%`],
    })),
  };

  const radius = size / 2;
  const innerRadius = radius - THICKNESS;

  const colorOf = (slice: DonutSlice, index: number) => slice.color ?? seriesColorAt(index);

  const chartConfig: ChartConfig = Object.fromEntries(
    slices.map((slice, index) => [slice.id, { label: slice.label, color: colorOf(slice, index) }])
  );

  return (
    <div data-slot="donut-chart" className={cn("flex flex-wrap items-center gap-x-8 gap-y-4", className)}>
      <div role="img" aria-label={label} className="relative shrink-0" style={{ width: size, height: size }}>
        <ChartContainer config={chartConfig} className="aspect-auto" style={{ width: size, height: size }}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="id"
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={radius}
              stroke="none"
              isAnimationActive={false}
              onClick={
                isInteractive
                  ? (_, index) => onSelect?.(selectedId === slices[index].id ? null : slices[index].id)
                  : undefined
              }
            >
              {slices.map((slice, index) => {
                const isSelected = selectedId === slice.id;
                const isDimmed = isInteractive && selectedId != null && !isSelected;

                return (
                  <Cell
                    key={slice.id}
                    fill={colorOf(slice, index)}
                    opacity={isDimmed ? 0.35 : 1}
                    className={cn(isInteractive && "cursor-pointer")}
                  />
                );
              })}
            </Pie>
          </PieChart>
        </ChartContainer>
        {centerLabel != null && (
          <div
            data-slot="donut-chart-center-label"
            data-testid={DATA_TEST_ID.CENTER_LABEL}
            aria-hidden="true"
            className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center"
          >
            <span className="text-2xl font-semibold text-foreground">{centerLabel}</span>
            {centerCaption && <span className="text-xs text-muted-foreground">{centerCaption}</span>}
          </div>
        )}
      </div>

      <ChartLegend
        orientation="vertical"
        items={slices.map((slice, index) => ({
          id: slice.id,
          label: slice.label,
          color: colorOf(slice, index),
          value: `${percentageOf(slice.value, total)}%`,
        }))}
        onSelect={onSelect}
        selectedId={selectedId}
        className="min-w-0 flex-1"
      />

      <ChartDataTable table={table} />
    </div>
  );
}
