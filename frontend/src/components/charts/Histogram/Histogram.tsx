import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChartGrid, labelStride } from "@/components/charts/components/ChartAxes";
import { ChartFrame, type ChartTable } from "@/components/charts/components/ChartFrame";
import { ChartTooltip } from "@/components/charts/components/ChartTooltip";
import { CHART_TARGET_COLOR, seriesColorAt } from "@/components/charts/chart-palette";
import {
  axisMax,
  formatNumber,
  niceTicks,
  plotFrom,
  topRoundedRectPath,
  type ChartMargin,
} from "@/components/charts/chart-scale";

const uniqueId = "6e0b3f84-52a7-4c16-b9d8-0741ca25e3b6";

export const DATA_TEST_ID = {
  BIN: `histogram-bin-${uniqueId}`,
  TARGET: `histogram-target-${uniqueId}`,
  TARGET_LABEL: `histogram-target-label-${uniqueId}`,
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

const MARGIN: ChartMargin = { top: 20, right: 12, bottom: 28, left: 44 };
const GAP = 2;
const CORNER_RADIUS = 4;

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
  const [hovered, setHovered] = useState<{ index: number; x: number; y: number } | null>(null);

  const isEmpty = bins.length === 0;
  const peak = Math.max(0, ...bins.map((bin) => bin.count));
  const max = axisMax(peak);
  const ticks = niceTicks(peak);

  const domainFrom = Math.min(...bins.map((bin) => bin.from), target ?? Infinity);
  const domainTo = Math.max(...bins.map((bin) => bin.to), target ?? -Infinity);
  const domainSpan = domainTo - domainFrom || 1;

  const rangeOf = (bin: HistogramBin) =>
    t("charts.histogram.range", { from: boundFormatter(bin.from), to: boundFormatter(bin.to) });

  const table: ChartTable = {
    caption: label,
    columns: [t("charts.table.range"), t("charts.table.count")],
    rows: bins.map((bin) => ({ header: rangeOf(bin), cells: [countFormatter(bin.count)] })),
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
      overlay={(width) =>
        hovered && (
          <ChartTooltip
            title={rangeOf(bins[hovered.index])}
            x={hovered.x}
            y={hovered.y}
            containerWidth={width}
            rows={[
              {
                label: countLabel ?? t("charts.table.count"),
                value: countFormatter(bins[hovered.index].count),
                color: seriesColorAt(0),
              },
            ]}
          />
        )
      }
    >
      {(width) => {
        const plot = plotFrom(width, height, MARGIN);
        const xOf = (value: number) => plot.left + ((value - domainFrom) / domainSpan) * plot.width;
        const baseline = plot.top + plot.height;
        const bounds = [...bins.map((bin) => bin.from), bins[bins.length - 1].to];

        return (
          <>
            <ChartGrid ticks={ticks} max={max} plot={plot} />

            {bins.map((bin, index) => {
              const left = xOf(bin.from);
              const binWidth = Math.max(1, xOf(bin.to) - left - GAP);
              const barHeight = max > 0 ? (bin.count / max) * plot.height : 0;

              return (
                <g key={`${bin.from}-${bin.to}`}>
                  <rect
                    x={left}
                    y={plot.top}
                    width={binWidth + GAP}
                    height={plot.height}
                    fill="transparent"
                    onPointerMove={(event) => {
                      const svgBounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                      if (!svgBounds) return;
                      setHovered({ index, x: event.clientX - svgBounds.left, y: event.clientY - svgBounds.top });
                    }}
                    onPointerLeave={() => setHovered(null)}
                  />
                  {barHeight > 0 && (
                    <path
                      data-testid={DATA_TEST_ID.BIN}
                      data-bin-width={binWidth}
                      d={topRoundedRectPath(left, baseline - barHeight, binWidth, barHeight, CORNER_RADIUS)}
                      fill={seriesColorAt(0)}
                      className="pointer-events-none"
                    />
                  )}
                </g>
              );
            })}

            {/* Labelled at the bin edges: "0" under a 0–5 bar's middle would
                claim the middle is zero. The last upper bound closes the axis. */}
            <g aria-hidden="true">
              {bounds.map((bound, index) => {
                const stride = labelStride(bounds, plot.width);
                if (index % stride !== 0 && index !== bounds.length - 1) return null;
                return (
                  <text
                    key={bound}
                    x={xOf(bound)}
                    y={baseline + 18}
                    // Outermost labels pull inward so they can't run off the plot.
                    textAnchor={index === 0 ? "start" : index === bounds.length - 1 ? "end" : "middle"}
                    className="fill-muted-foreground text-[11px] tabular-nums"
                  >
                    {boundFormatter(bound)}
                  </text>
                );
              })}
            </g>

            {target != null && (
              <g aria-hidden="true">
                <line
                  data-testid={DATA_TEST_ID.TARGET}
                  x1={xOf(target)}
                  y1={plot.top - 4}
                  x2={xOf(target)}
                  y2={baseline}
                  stroke={CHART_TARGET_COLOR}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
                {targetLabel && (
                  <text
                    data-testid={DATA_TEST_ID.TARGET_LABEL}
                    x={xOf(target)}
                    y={plot.top - 10}
                    textAnchor={xOf(target) > plot.left + plot.width * 0.8 ? "end" : "middle"}
                    className="fill-muted-foreground text-[11px]"
                  >
                    {targetLabel}
                  </text>
                )}
              </g>
            )}
          </>
        );
      }}
    </ChartFrame>
  );
}
