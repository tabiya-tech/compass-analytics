import type { ReactNode, SVGProps } from "react";
import { useTranslation } from "react-i18next";
import { ChartEmpty } from "@/components/charts/components/ChartEmpty";
import { cn } from "@/lib/utils";
import { useMeasure } from "@/components/charts/use-measure";

const uniqueId = "3a1e8f42-6d5b-4c19-9f77-2b0c8d4e1a63";

export const DATA_TEST_ID = {
  CONTAINER: `chart-frame-container-${uniqueId}`,
  PLOT: `chart-frame-plot-${uniqueId}`,
  TABLE: `chart-frame-table-${uniqueId}`,
  EMPTY: `chart-frame-empty-${uniqueId}`,
};

export interface ChartTableRow {
  header: string;
  cells: readonly string[];
}

export interface ChartTable {
  caption: string;
  columns: readonly string[];
  rows: readonly ChartTableRow[];
}

export interface ChartFrameProps {
  label: string;
  height: number;
  table: ChartTable;
  isEmpty?: boolean;
  emptyMessage?: string;
  isLoading?: boolean;
  children: (width: number) => ReactNode;
  footer?: ReactNode;
  overlay?: (width: number) => ReactNode;
  svgProps?: SVGProps<SVGSVGElement>;
  className?: string;
}

export function ChartFrame({
  label,
  height,
  table,
  isEmpty = false,
  emptyMessage,
  isLoading = false,
  children,
  footer,
  overlay,
  svgProps,
  className,
}: Readonly<ChartFrameProps>) {
  const { t } = useTranslation();
  const [containerRef, width] = useMeasure<HTMLDivElement>();

  // On a first load there will be data — say so rather than claiming there is none.
  if (isEmpty) {
    return (
      <div
        data-slot="chart-frame"
        data-testid={DATA_TEST_ID.CONTAINER}
        className={cn("w-full", className)}
        style={{ minHeight: height }}
      >
        <div data-testid={DATA_TEST_ID.EMPTY}>
          <ChartEmpty message={isLoading ? t("common.loading") : (emptyMessage ?? t("charts.empty"))} />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-slot="chart-frame"
      data-testid={DATA_TEST_ID.CONTAINER}
      // Held at reduced opacity while refetching, never swapped for a skeleton.
      className={cn(
        "relative w-full transition-opacity duration-(--duration-base)",
        isLoading && "opacity-60",
        className
      )}
      aria-busy={isLoading || undefined}
    >
      {/* Marks need a pixel width; skip the first, unmeasured pass. */}
      {width > 0 && (
        <svg
          data-slot="chart-frame-plot"
          data-testid={DATA_TEST_ID.PLOT}
          role="img"
          aria-label={label}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block max-w-full overflow-visible"
          {...svgProps}
        >
          {children(width)}
        </svg>
      )}
      {width > 0 && overlay?.(width)}
      {footer}
      <ChartDataTable table={table} />
    </div>
  );
}

export function ChartDataTable({ table }: Readonly<{ table: ChartTable }>) {
  return (
    <table data-slot="chart-frame-table" data-testid={DATA_TEST_ID.TABLE} className="sr-only">
      <caption>{table.caption}</caption>
      <thead>
        <tr>
          {table.columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row) => (
          <tr key={row.header}>
            <th scope="row">{row.header}</th>
            {/* Keyed by column header: cells are positional and may repeat a value. */}
            {row.cells.map((cell, index) => (
              <td key={table.columns[index + 1] ?? index}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
