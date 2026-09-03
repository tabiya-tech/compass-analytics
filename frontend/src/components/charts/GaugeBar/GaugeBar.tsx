import { useTranslation } from "react-i18next";
import { Bar, BarChart as RechartsBarChart, XAxis, YAxis } from "recharts";
import {
  CHART_PROGRESS_ACTIVE_COLOR,
  CHART_PROGRESS_DONE_COLOR,
  CHART_TARGET_COLOR,
} from "@/components/charts/chart-palette";
import { formatNumber } from "@/components/charts/chart-scale";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const uniqueId = "5e4c9f0b-8e3a-4a71-9d8a-9b9f9f2c6b71";

export const DATA_TEST_ID = {
  CONTAINER: `gauge-bar-container-${uniqueId}`,
  CAPTION: `gauge-bar-caption-${uniqueId}`,
  TRACK: `gauge-bar-track-${uniqueId}`,
};

export interface GaugeBarProps {
  label: string;
  value: number;
  secondaryValue?: number;
  max?: number;
  valueLabel?: string;
  secondaryValueLabel?: string;
  valueFormatter?: (value: number) => string;
  className?: string;
}

const CHART_CONFIG: ChartConfig = {};

export function GaugeBar({
  label,
  value,
  secondaryValue,
  max,
  valueLabel,
  secondaryValueLabel,
  valueFormatter = formatNumber,
  className,
}: Readonly<GaugeBarProps>) {
  const { t } = useTranslation();

  const outer = Math.max(value, secondaryValue ?? value);
  const scaleMax = max ?? outer;
  // A zero-or-negative scale has no meaningful proportion to plot — give the
  // axis a domain it can still render against rather than a degenerate [0, 0].
  const domainMax = scaleMax > 0 ? scaleMax : 1;

  // A second figure (e.g. "started" alongside "completed") isn't a target to
  // pass or fail against — it's a further stage of the same progress, so it
  // always reads as two shades of green rather than a pass/fail color.
  const isTwoStageProgress = secondaryValue != null;

  // With no explicit target there is nothing to fail against: auto-scaling to
  // the value's own outer figure is always read as "on track".
  const isOnTrack = max == null || value >= max;
  const primaryColor = isTwoStageProgress
    ? CHART_PROGRESS_DONE_COLOR
    : isOnTrack
      ? "var(--chart-1)"
      : CHART_TARGET_COLOR;
  const remainderColor = isTwoStageProgress ? CHART_PROGRESS_ACTIVE_COLOR : "var(--muted-foreground)";

  const caption =
    secondaryValue == null
      ? t("charts.gaugeBar.oneValue", { value: valueFormatter(value), valueLabel })
      : t("charts.gaugeBar.twoValues", {
          value: valueFormatter(value),
          valueLabel,
          secondaryValue: valueFormatter(secondaryValue),
          secondaryLabel: secondaryValueLabel,
        });

  // Stack value + remainder into one bar instead of two overlapping ones.
  const chartData = [{ name: "value", value, remainder: Math.max(0, outer - value) }];

  return (
    <div data-slot="gauge-bar" data-testid={DATA_TEST_ID.CONTAINER} className={cn(className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-4 text-sm">
        <span className="truncate font-semibold text-foreground text-[13px]">{label}</span>
        <span data-testid={DATA_TEST_ID.CAPTION} className="shrink-0 font-mono text-[13px] text-grey-text">
          {caption}
        </span>
      </div>
      <div
        data-testid={DATA_TEST_ID.TRACK}
        aria-hidden="true"
        className="h-3.5 w-full overflow-hidden rounded-full bg-surface-wash"
      >
        <ChartContainer config={CHART_CONFIG} className="aspect-auto h-full w-full">
          <RechartsBarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            barCategoryGap={0}
            accessibilityLayer={false}
          >
            <XAxis type="number" hide domain={[0, domainMax]} allowDataOverflow />
            <YAxis type="category" dataKey="name" hide />
            <Bar dataKey="value" stackId="gauge" fill={primaryColor} isAnimationActive={false} />
            <Bar dataKey="remainder" stackId="gauge" fill={remainderColor} isAnimationActive={false} />
          </RechartsBarChart>
        </ChartContainer>
      </div>
    </div>
  );
}
