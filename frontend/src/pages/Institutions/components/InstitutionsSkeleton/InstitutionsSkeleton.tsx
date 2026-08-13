import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const uniqueId = "7c1a4e92-08f5-4d3b-9a61-5f2c8d47b0e3";

export const DATA_TEST_ID = {
  CONTAINER: `institutions-skeleton-container-${uniqueId}`,
  ROW: `institutions-skeleton-row-${uniqueId}`,
};

export interface InstitutionsSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function InstitutionsSkeleton({ rows = 8, columns = 6, className }: Readonly<InstitutionsSkeletonProps>) {
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

      <div aria-hidden="true" className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-[132px] rounded-card" />
        <Skeleton className="h-[132px] rounded-card" />
        <Skeleton className="h-[132px] rounded-card" />
      </div>

      <div aria-hidden="true" className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-11 w-full max-w-sm rounded-pill" />
        <Skeleton className="h-3 w-32" />
      </div>

      <div aria-hidden="true" className="overflow-hidden rounded-card border bg-card">
        <div className="flex items-center gap-6 border-b bg-muted px-4 py-6">
          {columnKeys.map((key, column) => (
            <Skeleton key={key} className={cn("h-3", column === 0 ? "w-40" : "w-20 grow")} />
          ))}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={`row-${row}`}
            data-testid={DATA_TEST_ID.ROW}
            className="flex items-center gap-6 px-4 py-5 not-last:border-b"
          >
            {columnKeys.map((key, column) => (
              <Skeleton key={key} className={cn("h-4", column === 0 ? "w-40" : "w-20 grow")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
