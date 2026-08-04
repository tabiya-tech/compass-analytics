import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChartEmpty } from "@/components/charts/components/ChartEmpty";
import { cn } from "@/lib/utils";
import { ChartDataTable, type ChartTable } from "@/components/charts/components/ChartFrame";
import { ChartLegend } from "@/components/charts/components/ChartLegend";
import { seriesColorAt } from "@/components/charts/chart-palette";
import { formatNumber, percentageOf } from "@/components/charts/chart-scale";

const uniqueId = "4b8e1d67-c052-4937-8ab4-e91f7c60d3b8";

export const DATA_TEST_ID = {
  CONTAINER: `donut-chart-container-${uniqueId}`,
  PLOT: `donut-chart-plot-${uniqueId}`,
  SEGMENT: `donut-chart-segment-${uniqueId}`,
  CENTER_LABEL: `donut-chart-center-label-${uniqueId}`,
  EMPTY: `donut-chart-empty-${uniqueId}`,
};

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
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
const GAP_DEGREES = 2;

function polar(center: number, radius: number, degrees: number): [number, number] {
  // -90° so the first segment starts at 12 o'clock.
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [
    Math.round((center + radius * Math.cos(radians)) * 100) / 100,
    Math.round((center + radius * Math.sin(radians)) * 100) / 100,
  ];
}

/** An annular sector between two angles, clockwise from 12 o'clock. */
function arcPath(center: number, outer: number, inner: number, startDeg: number, endDeg: number): string {
  const sweep = endDeg - startDeg;
  if (sweep <= 0) return "";

  // A 360° arc has coincident endpoints, so a full ring needs two half-arcs.
  if (sweep >= 360) {
    return [
      `M${center},${center - outer}`,
      `A${outer},${outer} 0 1 1 ${center},${center + outer}`,
      `A${outer},${outer} 0 1 1 ${center},${center - outer}`,
      `M${center},${center - inner}`,
      `A${inner},${inner} 0 1 0 ${center},${center + inner}`,
      `A${inner},${inner} 0 1 0 ${center},${center - inner}`,
      "Z",
    ].join(" ");
  }

  const largeArc = sweep > 180 ? 1 : 0;
  const [ox1, oy1] = polar(center, outer, startDeg);
  const [ox2, oy2] = polar(center, outer, endDeg);
  const [ix1, iy1] = polar(center, inner, endDeg);
  const [ix2, iy2] = polar(center, inner, startDeg);

  return [
    `M${ox1},${oy1}`,
    `A${outer},${outer} 0 ${largeArc} 1 ${ox2},${oy2}`,
    `L${ix1},${iy1}`,
    `A${inner},${inner} 0 ${largeArc} 0 ${ix2},${iy2}`,
    "Z",
  ].join(" ");
}

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
        <ChartEmpty message={emptyMessage ?? t("charts.empty")} />
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
  const center = radius;
  const innerRadius = radius - THICKNESS;
  // A gap cut into a single slice would read as a missing segment, not 100%.
  const gap = slices.length > 1 ? GAP_DEGREES : 0;

  let angle = 0;

  return (
    <div
      data-slot="donut-chart"
      data-testid={DATA_TEST_ID.CONTAINER}
      className={cn("flex flex-wrap items-center gap-x-8 gap-y-4", className)}
    >
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          data-testid={DATA_TEST_ID.PLOT}
          role="img"
          aria-label={label}
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="block"
        >
          {slices.map((slice, index) => {
            const sweep = (slice.value / total) * 360;
            const start = angle;
            angle += sweep;

            const isSelected = selectedId === slice.id;
            const isDimmed = isInteractive && selectedId != null && !isSelected;

            return (
              <path
                key={slice.id}
                data-testid={DATA_TEST_ID.SEGMENT}
                data-slice={slice.id}
                data-selected={isSelected || undefined}
                d={arcPath(center, radius, innerRadius, start + gap / 2, start + sweep - gap / 2)}
                fill={seriesColorAt(index)}
                opacity={isDimmed ? 0.35 : 1}
                onClick={isInteractive ? () => onSelect?.(isSelected ? null : slice.id) : undefined}
                className={cn(
                  "transition-opacity duration-(--duration-fast)",
                  isInteractive && "cursor-pointer hover:opacity-80"
                )}
              />
            );
          })}
        </svg>
        {centerLabel != null && (
          <div
            data-slot="donut-chart-center-label"
            data-testid={DATA_TEST_ID.CENTER_LABEL}
            // Decorative: the figure belongs to the stat beside the chart.
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
          color: seriesColorAt(index),
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
