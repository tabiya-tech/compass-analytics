import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const uniqueId = "8b2f61c4-0d97-4e35-a1c8-6f403d9b72e5";

export const DATA_TEST_ID = {
  CONTAINER: `jobseekers-skeleton-container-${uniqueId}`,
  ROW: `jobseekers-skeleton-row-${uniqueId}`,
};

export interface JobseekersSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function JobseekersSkeleton({ rows = 8, columns = 6, className }: Readonly<JobseekersSkeletonProps>) {
  const { t } = useTranslation();
  const columnKeys = Array.from({ length: columns }, (_, column) => `column-${column}`);

  return (
    <div
      role="status"
      aria-busy="true"
      data-testid={DATA_TEST_ID.CONTAINER}
      className={cn("grid min-w-0 gap-6", className)}
    >
      <span className="sr-only">{t("common.loading")}</span>

      <div aria-hidden="true" className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-11 w-full max-w-sm rounded-pill" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-40 rounded-pill" />
        </div>
      </div>

      <div aria-hidden="true" className="overflow-hidden rounded-card border bg-card">
        <div className="flex items-center gap-6 border-b bg-muted px-4 py-6">
          {columnKeys.map((key, column) => (
            <Skeleton key={key} className={cn("h-3", column === 0 ? "w-48" : "w-20 grow")} />
          ))}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={`row-${row}`}
            data-testid={DATA_TEST_ID.ROW}
            className="flex items-center gap-6 px-4 py-4 not-last:border-b"
          >
            <Skeleton className="size-8 shrink-0 rounded-full" />
            {columnKeys.map((key, column) => (
              <Skeleton key={key} className={cn("h-4", column === 0 ? "w-40" : "w-20 grow")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
