import { cn } from "@/lib/utils";

const uniqueId = "b7c40f18-9a26-4d3e-8c51-e0f2a6b93d47";

export const DATA_TEST_ID = {
  CONTAINER: `chart-tooltip-container-${uniqueId}`,
  ROW: `chart-tooltip-row-${uniqueId}`,
};

export interface ChartTooltipRow {
  label: string;
  value: string;
  color: string;
}

export interface ChartTooltipProps {
  title: string;
  rows: readonly ChartTooltipRow[];
  x: number;
  y: number;
  containerWidth: number;
  className?: string;
}

const OFFSET = 12;
const ESTIMATED_WIDTH = 168;

export function ChartTooltip({ title, rows, x, y, containerWidth, className }: Readonly<ChartTooltipProps>) {
  // Flips left near the right edge so the card stays inside the chart.
  const flip = x + OFFSET + ESTIMATED_WIDTH > containerWidth;

  return (
    <div
      data-slot="chart-tooltip"
      data-testid={DATA_TEST_ID.CONTAINER}
      aria-hidden="true"
      style={{ left: x + (flip ? -OFFSET : OFFSET), top: y }}
      className={cn(
        "pointer-events-none absolute z-10 min-w-32 rounded-md border border-border bg-popover px-3 py-2 shadow-md",
        "-translate-y-1/2",
        flip && "-translate-x-full",
        className
      )}
    >
      <p className="mb-1.5 font-mono text-[11px] tracking-[1px] text-muted-foreground uppercase">{title}</p>
      <ul className="grid gap-1">
        {rows.map((row) => (
          <li key={row.label} data-testid={DATA_TEST_ID.ROW} className="flex items-center gap-2 text-sm">
            <span aria-hidden="true" className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: row.color }} />
            <span className="font-semibold text-foreground tabular-nums">{row.value}</span>
            <span className="truncate text-muted-foreground">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
