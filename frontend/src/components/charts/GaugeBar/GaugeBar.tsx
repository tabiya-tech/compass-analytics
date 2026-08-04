import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/components/charts/chart-scale";

const uniqueId = "a2f70e59-6c81-4bd3-9074-51e3a8c6b207";

export const DATA_TEST_ID = {
  CONTAINER: `gauge-bar-container-${uniqueId}`,
  CAPTION: `gauge-bar-caption-${uniqueId}`,
  TRACK: `gauge-bar-track-${uniqueId}`,
  DONE: `gauge-bar-done-${uniqueId}`,
  ACTIVE: `gauge-bar-active-${uniqueId}`,
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

function percentageOfScale(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

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

  const caption =
    secondaryValue == null
      ? t("charts.gaugeBar.oneValue", { value: valueFormatter(value), valueLabel })
      : t("charts.gaugeBar.twoValues", {
          value: valueFormatter(value),
          valueLabel,
          secondaryValue: valueFormatter(secondaryValue),
          secondaryLabel: secondaryValueLabel,
        });

  return (
    <div data-slot="gauge-bar" data-testid={DATA_TEST_ID.CONTAINER} className={cn(className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-4 text-sm">
        <span className="truncate font-medium text-foreground">{label}</span>
        <span data-testid={DATA_TEST_ID.CAPTION} className="shrink-0 font-mono text-xs text-muted-foreground">
          {caption}
        </span>
      </div>
      {/* One clipping track: outer ends curve, the inner boundary stays square. */}
      <div
        data-testid={DATA_TEST_ID.TRACK}
        aria-hidden="true"
        className="relative h-2 w-full overflow-hidden rounded-full bg-chart-track"
      >
        <span
          data-testid={DATA_TEST_ID.ACTIVE}
          className="absolute inset-y-0 left-0 bg-chart-progress-active transition-[width] duration-(--duration-base) ease-(--ease-out)"
          style={{ width: `${percentageOfScale(outer, scaleMax)}%` }}
        />
        <span
          data-testid={DATA_TEST_ID.DONE}
          className="absolute inset-y-0 left-0 bg-chart-progress-done transition-[width] duration-(--duration-base) ease-(--ease-out)"
          style={{ width: `${percentageOfScale(value, scaleMax)}%` }}
        />
      </div>
    </div>
  );
}
