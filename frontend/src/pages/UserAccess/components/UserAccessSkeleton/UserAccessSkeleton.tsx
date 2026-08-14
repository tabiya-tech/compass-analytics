import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const uniqueId = "b53e7f04-9c18-4d62-a7be-2f61d0c48a95";

export const DATA_TEST_ID = {
  CONTAINER: `user-access-skeleton-container-${uniqueId}`,
  ROW: `user-access-skeleton-row-${uniqueId}`,
};

export interface UserAccessSkeletonProps {
  rows?: number;
  className?: string;
}

export function UserAccessSkeleton({ rows = 6, className }: Readonly<UserAccessSkeletonProps>) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-busy="true"
      data-testid={DATA_TEST_ID.CONTAINER}
      className={cn("grid min-w-0 gap-3 rounded-card border bg-card p-4", className)}
    >
      <span className="sr-only">{t("common.loading")}</span>

      {Array.from({ length: rows }, (_, row) => (
        <div
          key={`row-${row}`}
          aria-hidden="true"
          data-testid={DATA_TEST_ID.ROW}
          className="flex items-center justify-between gap-4 rounded-card bg-muted px-5 py-4"
        >
          <div className="flex items-center gap-4">
            <Skeleton className="size-11 rounded-full" />
            <div className="grid gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-52" />
            </div>
          </div>
          <Skeleton className="h-11 w-[190px] rounded-pill" />
        </div>
      ))}
    </div>
  );
}
