import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import { seriesColorAt } from "@/components/charts/chart-palette";
import { formatNumber } from "@/components/charts/chart-scale";
import { cn } from "@/lib/utils";

export const DATA_TEST_ID = {
  EMPTY: "h-bar-empty",
  ROW: "h-bar-row",
  BAR: "h-bar-bar",
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
  max?: number;
  onSelect?: (id: string | null) => void;
  selectedId?: string | null;
  emptyMessage?: string;
  valueFormatter?: (value: number) => string;
  className?: string;
}

export function HBar({
  label,
  items,
  color = seriesColorAt(0),
  max,
  onSelect,
  selectedId,
  emptyMessage,
  valueFormatter = formatNumber,
  className,
}: Readonly<HBarProps>) {
  const { t } = useTranslation();
  const isInteractive = Boolean(onSelect);

  if (items.length === 0) {
    return (
      <div data-testid={DATA_TEST_ID.EMPTY} className={cn("grid gap-1.5", className)}>
        <span className="text-sm text-muted-foreground">{emptyMessage ?? t("charts.empty")}</span>
        <Progress value={0} aria-hidden="true" className="h-2" />
      </div>
    );
  }

  const scaleMax = max ?? Math.max(0, ...items.map((item) => item.value));

  return (
    <ul data-slot="h-bar" aria-label={label} className={cn("grid gap-3.5", className)}>
      {items.map((item) => {
        const percentage = scaleMax > 0 ? (item.value / scaleMax) * 100 : 0;
        const isSelected = selectedId === item.id;
        const isDimmed = isInteractive && selectedId != null && !isSelected;

        const row = (
          <>
            <span className="flex items-baseline justify-between gap-4">
              <span className="truncate text-foreground text-[13px]">{item.label}</span>
              <span className="shrink-0 text-grey-text tabular-nums text-[13px]">{valueFormatter(item.value)}</span>
            </span>
            <Progress
              data-testid={DATA_TEST_ID.BAR}
              aria-hidden="true"
              value={percentage}
              className={cn(
                "mt-1.5 h-2 transition-opacity **:data-[slot=progress-indicator]:bg-(--h-bar-fill)",
                isDimmed && "opacity-40"
              )}
              style={{ "--h-bar-fill": color } as CSSProperties}
            />
          </>
        );

        return (
          <li key={item.id} data-testid={DATA_TEST_ID.ROW} data-selected={isSelected || undefined} className="text-sm">
            {isInteractive ? (
              <button
                type="button"
                onClick={() => onSelect?.(isSelected ? null : item.id)}
                aria-pressed={isSelected}
                className="w-full cursor-pointer rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {row}
              </button>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}
