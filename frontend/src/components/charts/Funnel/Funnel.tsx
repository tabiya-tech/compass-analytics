import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/shared/EmptyState";
import { ChartDataTable, type ChartTable } from "@/components/charts/components/ChartDataTable";
import { funnelStopAt } from "@/components/charts/chart-palette";
import { formatNumber, percentageOf } from "@/components/charts/chart-scale";
import { cn } from "@/lib/utils";

const uniqueId = "9d3c6b51-7f24-4a08-b6e9-38c0d5f21ab7";

export const DATA_TEST_ID = {
  CONTAINER: `funnel-container-${uniqueId}`,
  EMPTY: `funnel-empty-${uniqueId}`,
  STAGE: `funnel-stage-${uniqueId}`,
  BAR: `funnel-bar-${uniqueId}`,
  DROP_OFF: `funnel-drop-off-${uniqueId}`,
  CAPTION: `funnel-caption-${uniqueId}`,
};

export interface FunnelStage {
  id: string;
  label: string;
  value: number;
}

export interface FunnelProps {
  label: string;
  /** In funnel order, widest first — the first stage is the 100% the rest are read against. */
  stages: readonly FunnelStage[];
  valueCaption?: string;
  dropOffCaption?: string;
  isLoading?: boolean;
  emptyMessage?: string;
  valueFormatter?: (value: number) => string;
  className?: string;
}

/** Keeps a nearly-empty final stage a readable bar rather than a sliver. */
const MIN_BAR_WIDTH_PERCENTAGE = 12;

const GRID = "grid grid-cols-[minmax(0,7rem)_1fr] gap-x-4 sm:grid-cols-[minmax(0,7rem)_1fr_minmax(0,5rem)]";

/** A minus sign, not a hyphen — a drop-off is a quantity lost, and is read out as one. */
function formatDropOff(value: number, valueFormatter: (value: number) => string): string {
  return `−${valueFormatter(value)}`;
}

/** Stage-by-stage drop-off: bars tapering with the count that reached each stage, and what was lost since the last. */
export function Funnel({
  label,
  stages,
  valueCaption,
  dropOffCaption,
  isLoading = false,
  emptyMessage,
  valueFormatter = formatNumber,
  className,
}: Readonly<FunnelProps>) {
  const { t } = useTranslation();

  const entryValue = stages[0]?.value ?? 0;
  // Return empty state if no data (zero entry) instead of showing placeholder bars.
  if (stages.length === 0 || entryValue === 0) {
    return (
      <div data-testid={DATA_TEST_ID.EMPTY} className={cn("w-full", className)}>
        <EmptyState message={isLoading ? t("common.loading") : (emptyMessage ?? t("charts.empty"))} />
      </div>
    );
  }

  const resolvedDropOffCaption = dropOffCaption ?? t("charts.funnel.dropOff");

  const rows = stages.map((stage, index) => {
    const previous = index > 0 ? stages[index - 1].value : null;
    // A stage that grew isn't a drop-off; only losses are reported.
    const dropOff = previous != null && previous > stage.value ? previous - stage.value : null;

    return {
      ...stage,
      share: percentageOf(stage.value, entryValue),
      // Cap at 100% to prevent overflow when later stages exceed entry stage.
      widthPercentage: Math.min(
        100,
        Math.max(MIN_BAR_WIDTH_PERCENTAGE, entryValue > 0 ? (stage.value / entryValue) * 100 : 0)
      ),
      stop: funnelStopAt(index, stages.length),
      dropOff,
    };
  });

  const table: ChartTable = {
    caption: label,
    columns: [t("charts.table.category"), t("charts.table.value"), t("charts.table.share"), resolvedDropOffCaption],
    rows: rows.map((row) => ({
      header: row.label,
      cells: [
        valueFormatter(row.value),
        t("charts.funnel.share", { value: row.share }),
        row.dropOff == null ? "" : formatDropOff(row.dropOff, valueFormatter),
      ],
    })),
  };

  return (
    <div
      data-slot="funnel"
      data-testid={DATA_TEST_ID.CONTAINER}
      aria-busy={isLoading || undefined}
      className={cn("w-full transition-opacity duration-(--duration-base)", isLoading && "opacity-60", className)}
    >
      {/* The bars carry their own figures as text, so the plot is hidden from assistive tech in favour of the table below. */}
      <div aria-hidden="true" className="grid gap-2.5">
        {rows.map((row) => (
          <div key={row.id} data-testid={DATA_TEST_ID.STAGE} data-stage={row.id} className={cn(GRID, "items-center")}>
            <span className="truncate text-right font-mono text-xs tracking-[2px] text-muted-foreground uppercase">
              {row.label}
            </span>
            <span className="flex justify-center">
              <span
                data-testid={DATA_TEST_ID.BAR}
                style={{ width: `${row.widthPercentage}%`, backgroundColor: row.stop.fill, color: row.stop.ink }}
                className="flex h-13 items-baseline justify-center gap-2 rounded-md px-3 py-4"
              >
                <span className="truncate font-bold tabular-nums">{valueFormatter(row.value)}</span>
                <span className="shrink-0 text-sm tabular-nums">{row.share}%</span>
              </span>
            </span>
            <span
              data-testid={DATA_TEST_ID.DROP_OFF}
              className="hidden text-right text-sm text-destructive tabular-nums sm:block"
            >
              {row.dropOff == null ? "" : formatDropOff(row.dropOff, valueFormatter)}
            </span>
          </div>
        ))}

        {(valueCaption || dropOffCaption) && (
          <div
            data-testid={DATA_TEST_ID.CAPTION}
            className={cn(GRID, "mt-2 items-center font-mono text-xs tracking-[2px] text-muted-foreground uppercase")}
          >
            <span />
            <span className="text-center">{valueCaption}</span>
            <span className="hidden text-right sm:block">{dropOffCaption}</span>
          </div>
        )}
      </div>

      <ChartDataTable table={table} />
    </div>
  );
}
