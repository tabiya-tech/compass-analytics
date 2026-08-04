import { cn } from "@/lib/utils";

const uniqueId = "5e2b91c7-4f83-4a60-b8d2-71c6e5a0f394";

export const DATA_TEST_ID = {
  CONTAINER: `chart-legend-container-${uniqueId}`,
  ITEM: `chart-legend-item-${uniqueId}`,
};

export interface ChartLegendItem {
  id: string;
  label: string;
  color: string;
  value?: string;
}

export interface ChartLegendProps {
  items: readonly ChartLegendItem[];
  markShape?: "rect" | "line";
  orientation?: "horizontal" | "vertical";
  onSelect?: (id: string | null) => void;
  selectedId?: string | null;
  className?: string;
}

export function ChartLegend({
  items,
  markShape = "rect",
  orientation = "horizontal",
  onSelect,
  selectedId,
  className,
}: Readonly<ChartLegendProps>) {
  const isInteractive = Boolean(onSelect);

  return (
    <ul
      data-slot="chart-legend"
      data-testid={DATA_TEST_ID.CONTAINER}
      className={cn(
        "flex text-sm",
        orientation === "horizontal" ? "flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-3" : "flex-col gap-2",
        className
      )}
    >
      {items.map((item) => {
        const isSelected = selectedId === item.id;
        const isDimmed = isInteractive && selectedId != null && !isSelected;

        const content = (
          <>
            <span
              aria-hidden="true"
              className={cn(
                "shrink-0 transition-opacity",
                markShape === "line" ? "h-0.5 w-4 rounded-full" : "size-2.5 rounded-[3px]",
                isDimmed && "opacity-40"
              )}
              style={{ background: item.color }}
            />
            <span className={cn("text-foreground", isSelected && "font-medium")}>{item.label}</span>
            {item.value && <span className="text-muted-foreground tabular-nums">{item.value}</span>}
          </>
        );

        return (
          <li key={item.id} data-testid={DATA_TEST_ID.ITEM} data-selected={isSelected || undefined}>
            {isInteractive ? (
              <button
                type="button"
                onClick={() => onSelect?.(isSelected ? null : item.id)}
                aria-pressed={isSelected}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-left",
                  "hover:bg-muted/60",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                )}
              >
                {content}
              </button>
            ) : (
              <span className="flex items-center gap-2">{content}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
