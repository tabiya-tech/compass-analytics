import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterMenu, type FilterMenuOption } from "@/components/shared/FilterMenu";
import type { InstitutionSortKey, InstitutionSummary, InstitutionsSort } from "@/institutions/institutions.types";
import type { InstitutionColumn } from "./columns";
import { cn } from "@/lib/utils";

const uniqueId = "9f0c1d3e-5a47-4f2b-8c6d-1b7e9a24c530";

export const DATA_TEST_ID = {
  CONTAINER: `institutions-table-container-${uniqueId}`,
  ROW: `institutions-table-row-${uniqueId}`,
  CELL: `institutions-table-cell-${uniqueId}`,
};

const NO_VALUE = "—";

export interface InstitutionsTableProps {
  institutions: readonly InstitutionSummary[];
  columns: readonly InstitutionColumn[];
  sort: InstitutionsSort;
  onSortChange: (sort: InstitutionsSort) => void;
  regionOptions: readonly FilterMenuOption[];
  selectedRegions: readonly string[];
  onSelectedRegionsChange: (regions: string[]) => void;
  onClearFilters: () => void;
  onInstitutionSelect: (institution: InstitutionSummary) => void;
  className?: string;
}

/** Clicking the sorted column flips it; a new column starts high-to-low for figures, A–Z for names. */
function nextSort(current: InstitutionsSort, column: InstitutionColumn): InstitutionsSort {
  const key = column.id as InstitutionSortKey; // only sortable columns reach here
  if (current.by === key) return { by: key, direction: current.direction === "asc" ? "desc" : "asc" };
  return { by: key, direction: column.numeric ? "desc" : "asc" };
}

function cellValue(institution: InstitutionSummary, column: InstitutionColumn): string {
  switch (column.id) {
    case "name":
      return institution.name;
    case "region":
      return institution.region;
    case "registered_users":
      return institution.registered_users.toLocaleString();
    case "active_users":
      return institution.active_users.toLocaleString();
    case "skills_reports":
      return institution.skills_reports?.toLocaleString() ?? NO_VALUE;
    default: {
      const startedPct = institution.module_started_pct[column.id];
      return startedPct === undefined ? NO_VALUE : `${startedPct}%`;
    }
  }
}

const SORT_ICONS = { asc: ChevronUp, desc: ChevronDown } as const;

export function InstitutionsTable({
  institutions,
  columns,
  sort,
  onSortChange,
  regionOptions,
  selectedRegions,
  onSelectedRegionsChange,
  onClearFilters,
  onInstitutionSelect,
  className,
}: Readonly<InstitutionsTableProps>) {
  const { t } = useTranslation();

  return (
    // min-w-0 keeps the table scrolling inside its box instead of widening the screen.
    <Table
      data-testid={DATA_TEST_ID.CONTAINER}
      containerClassName={cn("w-full min-w-0 rounded-card border bg-card", className)}
    >
      <TableCaption className="sr-only">{t("institutions.table.caption")}</TableCaption>
      <TableHeader>
        <TableRow className="bg-muted hover:bg-muted">
          {columns.map((column, index) => {
            const label = t(column.labelKey);
            const isSorted = column.sortable && sort.by === column.id;
            const SortIcon = isSorted ? SORT_ICONS[sort.direction] : ChevronDown;

            return (
              <TableHead
                key={column.id}
                scope="col"
                aria-sort={isSorted ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
                className={cn(
                  "sticky top-0 z-10 h-auto min-w-36 bg-inherit py-3 font-mono text-xs tracking-[2px] whitespace-normal text-muted-foreground uppercase",
                  column.numeric && "text-right",
                  // The institution name stays put while the metric columns scroll under it.
                  index === 0 && "left-0 z-20 min-w-56"
                )}
              >
                <span className={cn("flex items-center gap-1", column.numeric && "justify-end")}>
                  {column.sortable ? (
                    // shrink + min-w-0 let the label wrap to two lines instead of overflowing.
                    <Button
                      variant="ghost"
                      size="xs"
                      aria-label={t("institutions.table.sortBy", { label })}
                      onClick={() => onSortChange(nextSort(sort, column))}
                      className={cn(
                        // No hover background: the ghost variant's accent is the brand green.
                        "-mx-2 h-auto min-w-0 shrink items-center gap-1 py-1 font-mono text-xs leading-tight tracking-[2px] whitespace-normal uppercase hover:bg-transparent hover:text-foreground",
                        column.numeric && "justify-end text-right",
                        isSorted && "font-semibold text-foreground"
                      )}
                    >
                      <span>{label}</span>
                      <SortIcon aria-hidden="true" className={cn("shrink-0", !isSorted && "opacity-50")} />
                    </Button>
                  ) : (
                    <span className="leading-tight">{label}</span>
                  )}
                  {column.filterable && (
                    <FilterMenu
                      label={label}
                      options={regionOptions}
                      selected={selectedRegions}
                      onSelectionChange={onSelectedRegionsChange}
                      showLabel={false}
                      className="hover:bg-transparent hover:text-foreground"
                    />
                  )}
                </span>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {institutions.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns.length} className="p-0">
              <EmptyState
                message={t("institutions.table.empty")}
                action={{ label: t("institutions.table.clearFilters"), onClick: onClearFilters }}
              />
            </TableCell>
          </TableRow>
        ) : (
          institutions.map((institution) => (
            // The hover tint must be opaque — the sticky column inherits it, and a translucent
            // one lets the columns scrolling underneath show through.
            <TableRow
              key={institution.id}
              data-testid={DATA_TEST_ID.ROW}
              onClick={() => onInstitutionSelect(institution)}
              className="cursor-pointer bg-card hover:bg-muted"
            >
              {columns.map((column, index) => (
                <TableCell
                  key={column.id}
                  data-testid={DATA_TEST_ID.CELL}
                  data-column={column.id}
                  className={cn(
                    "py-4 text-foreground",
                    column.numeric && "text-right tabular-nums",
                    index === 0 && "sticky left-0 z-10 bg-inherit font-semibold"
                  )}
                >
                  {/* The name is the row's keyboard-reachable way into the drill-down. */}
                  {index === 0 ? (
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      onClick={(event) => {
                        event.stopPropagation(); // the row handles clicks too
                        onInstitutionSelect(institution);
                      }}
                      className="rounded-sm text-left outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {cellValue(institution, column)}
                    </button>
                  ) : (
                    cellValue(institution, column)
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
