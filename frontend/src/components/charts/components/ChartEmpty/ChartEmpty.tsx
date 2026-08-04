import { SearchX } from "lucide-react";
import { cn } from "@/lib/utils";

const uniqueId = "f0a37c62-9d18-4e5b-8a41-6b2ce9047d35";

export const DATA_TEST_ID = {
  CONTAINER: `chart-empty-container-${uniqueId}`,
  ICON: `chart-empty-icon-${uniqueId}`,
};

export interface ChartEmptyProps {
  message: string;
  className?: string;
}

export function ChartEmpty({ message, className }: Readonly<ChartEmptyProps>) {
  return (
    <div
      data-slot="chart-empty"
      data-testid={DATA_TEST_ID.CONTAINER}
      role="status"
      className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}
    >
      <span
        data-testid={DATA_TEST_ID.ICON}
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5"
      >
        <SearchX />
      </span>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
