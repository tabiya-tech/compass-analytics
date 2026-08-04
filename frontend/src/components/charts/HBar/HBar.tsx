import { useId, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { ChartEmpty } from "@/components/charts/components/ChartEmpty";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { seriesColorAt } from "@/components/charts/chart-palette";
import { formatNumber } from "@/components/charts/chart-scale";

const uniqueId = "0c96e4b2-7d13-4a58-9e07-64b1f8a3c2d5";

export const DATA_TEST_ID = {
  CONTAINER: `h-bar-container-${uniqueId}`,
  HEADING: `h-bar-heading-${uniqueId}`,
  ROW: `h-bar-row-${uniqueId}`,
  BAR: `h-bar-bar-${uniqueId}`,
  EMPTY: `h-bar-empty-${uniqueId}`,
};

export interface HBarItem {
  id: string;
  label: string;
  value: number;
}

export interface HBarProps {
  label: string;
  items: readonly HBarItem[];
  color?: string;
  showLabel?: boolean;
  max?: number;
  emptyMessage?: string;
  valueFormatter?: (value: number) => string;
  className?: string;
}

export function HBar({
  label,
  items,
  color = seriesColorAt(0),
  showLabel = false,
  max,
  emptyMessage,
  valueFormatter = formatNumber,
  className,
}: Readonly<HBarProps>) {
  const { t } = useTranslation();
  const headingId = useId();
  const scaleMax = max ?? Math.max(0, ...items.map((item) => item.value));

  if (items.length === 0) {
    return (
      <div data-testid={DATA_TEST_ID.EMPTY} className={className}>
        <ChartEmpty message={emptyMessage ?? t("charts.empty")} />
      </div>
    );
  }

  const rows = (
    <ul
      data-slot="h-bar"
      data-testid={DATA_TEST_ID.CONTAINER}
      {...(showLabel ? { "aria-labelledby": headingId } : { "aria-label": label })}
      className={cn("grid gap-4", !showLabel && className)}
    >
      {items.map((item) => {
        const percentage = scaleMax > 0 ? (item.value / scaleMax) * 100 : 0;

        return (
          <li key={item.id} data-testid={DATA_TEST_ID.ROW} className="text-sm">
            <span className="flex items-baseline justify-between gap-4">
              <span className="truncate text-foreground">{item.label}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">{valueFormatter(item.value)}</span>
            </span>
            <Progress
              data-testid={DATA_TEST_ID.BAR}
              aria-hidden="true"
              value={percentage}
              className="mt-1.5 h-2 bg-chart-track **:data-[slot=progress-indicator]:bg-(--h-bar-fill)"
              style={{ "--h-bar-fill": color } as CSSProperties}
            />
          </li>
        );
      })}
    </ul>
  );

  if (!showLabel) return rows;

  return (
    <div className={cn("grid gap-3", className)}>
      <p
        id={headingId}
        data-slot="h-bar-heading"
        data-testid={DATA_TEST_ID.HEADING}
        className="font-mono text-xs tracking-[2px] text-green-3 uppercase"
      >
        {label}
      </p>
      {rows}
    </div>
  );
}
