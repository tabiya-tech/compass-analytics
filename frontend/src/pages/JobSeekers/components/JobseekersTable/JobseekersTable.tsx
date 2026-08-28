import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterMenu } from "@/components/shared/FilterMenu";
import { UserAvatar } from "@/components/shared/UserAvatar";
import {
  MODULE_STATUSES,
  type JobseekerSortKey,
  type JobseekerSummary,
  type JobseekersSort,
  type ModuleStatus,
  type ModuleStatusFilters,
} from "@/jobseekers/jobseekers.types";
import { MODULE_STATUS_LABEL_KEYS, formatDay } from "@/pages/JobSeekers/utils";
import type { JobseekerColumn } from "./columns";
import { cn } from "@/lib/utils";

const uniqueId = "3e6d0b52-7c48-4a19-9f31-2b8c5d7e4106";

export const DATA_TEST_ID = {
  CONTAINER: `jobseekers-table-container-${uniqueId}`,
  ROW: `jobseekers-table-row-${uniqueId}`,
  CELL: `jobseekers-table-cell-${uniqueId}`,
  SKILLS_BUTTON: `jobseekers-table-skills-button-${uniqueId}`,
  NAME: `jobseekers-table-name-${uniqueId}`,
};

const TABLE_MAX_HEIGHT = "max-h-[70dvh]";

const SORT_ICONS = { asc: ChevronUp, desc: ChevronDown } as const;

export interface JobseekersTableProps {
  jobseekers: readonly JobseekerSummary[];
  columns: readonly JobseekerColumn[];
  sort: JobseekersSort;
  onSortChange: (sort: JobseekersSort) => void;
  moduleStatusFilters: ModuleStatusFilters;
  onModuleStatusFiltersChange: (filters: ModuleStatusFilters) => void;
  onClearFilters: () => void;
  onJobseekerSelect: (jobseeker: JobseekerSummary) => void;
  onSkillsSelect: (jobseeker: JobseekerSummary) => void;
  className?: string;
}

/** Clicking the sorted column flips it; a new column starts A–Z for names, highest/latest first otherwise. */
function nextSort(current: JobseekersSort, column: JobseekerColumn): JobseekersSort {
  const key = column.id as JobseekerSortKey; // only sortable columns reach here
  if (current.by === key) return { by: key, direction: current.direction === "asc" ? "desc" : "asc" };
  return { by: key, direction: key === "name" ? "asc" : "desc" };
}

// Below halfway reads as needing attention; a finished profile gets its own, more emphatic green.
// Same thresholds as the CompletionRing the profile drill-down uses, so the two never disagree.
function scoreColorOf(percentage: number): string {
  if (percentage >= 100) return "bg-green-3";
  if (percentage >= 50) return "bg-green-2";
  return "bg-amber-400";
}

function ProfileScoreBar({ value }: Readonly<{ value: number }>) {
  const percentage = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <span className="flex items-center justify-end gap-3">
      <span aria-hidden="true" className="h-1.5 w-full max-w-24 overflow-hidden rounded-pill bg-muted">
        <span
          className={cn("block h-full rounded-pill", scoreColorOf(percentage))}
          style={{ width: `${percentage}%` }}
        />
      </span>
      <span className="w-10 shrink-0 text-right font-mono text-xs font-bold tabular-nums">{percentage}%</span>
    </span>
  );
}

export function JobseekersTable({
  jobseekers,
  columns,
  sort,
  onSortChange,
  moduleStatusFilters,
  onModuleStatusFiltersChange,
  onClearFilters,
  onJobseekerSelect,
  onSkillsSelect,
  className,
}: Readonly<JobseekersTableProps>) {
  const { t } = useTranslation();

  const statusOptions = MODULE_STATUSES.map((status) => ({
    value: status,
    label: t(MODULE_STATUS_LABEL_KEYS[status]),
  }));

  const renderCell = (jobseeker: JobseekerSummary, column: JobseekerColumn) => {
    if (column.moduleId) {
      const status = jobseeker.module_status[column.moduleId] ?? "not_started";
      // Completion is the figure a reader scans for, so only it carries weight.
      return (
        <span className={cn(status === "completed" ? "font-semibold text-foreground" : "text-muted-foreground")}>
          {t(MODULE_STATUS_LABEL_KEYS[status])}
        </span>
      );
    }

    switch (column.id) {
      case "name":
        // The name is the row's keyboard-reachable way into the profile.
        return (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={(event) => {
              event.stopPropagation(); // the row handles clicks too
              onJobseekerSelect(jobseeker);
            }}
            className="flex items-center gap-3 rounded-sm text-left outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <UserAvatar name={jobseeker.name} size="sm" />
            <span className="grid gap-0.5">
              <span data-testid={DATA_TEST_ID.NAME} className="font-semibold">
                {jobseeker.name}
              </span>
              <span className="font-mono text-xs font-normal text-muted-foreground">{jobseeker.id}</span>
            </span>
          </button>
        );
      case "profile_score_pct":
        return <ProfileScoreBar value={jobseeker.profile_score_pct} />;
      case "registered_at":
        return <span className="text-muted-foreground">{formatDay(jobseeker.registered_at)}</span>;
      case "last_login_at":
        return <span className="text-muted-foreground">{formatDay(jobseeker.last_login_at)}</span>;
      default:
        return jobseeker.skills_report_ready ? (
          <Button
            variant="outline"
            size="sm"
            aria-haspopup="dialog"
            data-testid={DATA_TEST_ID.SKILLS_BUTTON}
            onClick={(event) => {
              event.stopPropagation();
              onSkillsSelect(jobseeker);
            }}
            className="rounded-pill border-primary"
          >
            <Sparkles aria-hidden="true" />
            {/* The roster only carries the elicited skills where the source can supply them
                cheaply; where it cannot, the button says what it does instead of counting to 0. */}
            {jobseeker.skills.length > 0
              ? t("jobseekers.table.skillsCount", { value: jobseeker.skills.length })
              : t("jobseekers.table.viewSkills")}
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground italic">{t("jobseekers.table.reportNotReady")}</span>
        );
    }
  };

  return (
    // min-w-0 keeps the table scrolling inside its box instead of widening the screen.
    <Table
      data-testid={DATA_TEST_ID.CONTAINER}
      containerClassName={cn(TABLE_MAX_HEIGHT, "w-full min-w-0 rounded-card border bg-card", className)}
    >
      <TableCaption className="sr-only">{t("jobseekers.table.caption")}</TableCaption>
      <TableHeader>
        <TableRow className="bg-muted hover:bg-muted">
          {columns.map((column, index) => {
            const label = t(column.labelKey);
            const isSorted = column.sortable && sort.by === column.id;
            const SortIcon = isSorted ? SORT_ICONS[sort.direction] : ChevronDown;
            const selectedStatuses = (column.moduleId && moduleStatusFilters[column.moduleId]) || [];

            return (
              <TableHead
                key={column.id}
                scope="col"
                aria-sort={isSorted ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
                className={cn(
                  "sticky top-0 z-10 h-auto min-w-36 bg-inherit py-3 font-mono text-xs tracking-[2px] whitespace-normal text-muted-foreground uppercase",
                  column.numeric && "text-right",
                  // The jobseeker stays put while the module columns scroll under it.
                  index === 0 && "left-0 z-20 min-w-60"
                )}
              >
                <span className={cn("flex items-center gap-1", column.numeric && "justify-end")}>
                  {column.sortable ? (
                    // shrink + min-w-0 let the label wrap to two lines instead of overflowing.
                    <Button
                      variant="ghost"
                      size="xs"
                      aria-label={t("jobseekers.table.sortBy", { label })}
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
                  {column.moduleId && (
                    <FilterMenu
                      label={label}
                      options={statusOptions}
                      selected={selectedStatuses}
                      onSelectionChange={(statuses) =>
                        onModuleStatusFiltersChange({
                          ...moduleStatusFilters,
                          [column.moduleId as string]: statuses as ModuleStatus[],
                        })
                      }
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
        {jobseekers.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns.length} className="p-0">
              <EmptyState
                message={t("jobseekers.table.empty")}
                action={{ label: t("jobseekers.table.clearFilters"), onClick: onClearFilters }}
              />
            </TableCell>
          </TableRow>
        ) : (
          jobseekers.map((jobseeker) => (
            // The hover tint must be opaque — the sticky column inherits it, and a translucent
            // one lets the columns scrolling underneath show through.
            <TableRow
              key={jobseeker.id}
              data-testid={DATA_TEST_ID.ROW}
              onClick={() => onJobseekerSelect(jobseeker)}
              className="cursor-pointer bg-card hover:bg-muted"
            >
              {columns.map((column, index) => (
                <TableCell
                  key={column.id}
                  data-testid={DATA_TEST_ID.CELL}
                  data-column={column.id}
                  className={cn(
                    "py-3 text-foreground",
                    column.numeric && "text-right tabular-nums",
                    index === 0 && "sticky left-0 z-10 bg-inherit"
                  )}
                >
                  {renderCell(jobseeker, column)}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
