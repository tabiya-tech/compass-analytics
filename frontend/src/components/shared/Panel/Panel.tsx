import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const uniqueId = "5e9b6d41-8a7c-4f02-b3d5-1c84e70f9a26";

export const DATA_TEST_ID = {
  CONTAINER: `panel-container-${uniqueId}`,
  TITLE: `panel-title-${uniqueId}`,
  DESCRIPTION: `panel-description-${uniqueId}`,
  ACTION: `panel-action-${uniqueId}`,
  CONTENT: `panel-content-${uniqueId}`,
  FOOTNOTE: `panel-footnote-${uniqueId}`,
};

export interface PanelProps {
  title: string;
  description?: string;
  action?: ReactNode;
  footnote?: string;
  isLoading?: boolean;
  testId?: string;
  children: ReactNode;
  className?: string;
}

export function Panel({
  title,
  description,
  action,
  footnote,
  isLoading = false,
  testId,
  children,
  className,
}: Readonly<PanelProps>) {
  return (
    <Card
      data-slot="panel"
      data-testid={testId ?? DATA_TEST_ID.CONTAINER}
      aria-busy={isLoading || undefined}
      className={cn(
        "gap-3 rounded-card py-6 transition-opacity duration-(--duration-base)",
        isLoading && "opacity-60",
        className
      )}
    >
      <CardHeader className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="grid min-w-56 flex-1 gap-1.5">
          <h2 data-testid={DATA_TEST_ID.TITLE} className="text-[17px] font-bold tracking-tight text-foreground">
            {title}
          </h2>
          {description && <CardDescription data-testid={DATA_TEST_ID.DESCRIPTION}>{description}</CardDescription>}
        </div>
        {action && (
          <div data-testid={DATA_TEST_ID.ACTION} className="shrink-0">
            {action}
          </div>
        )}
      </CardHeader>
      <CardContent data-testid={DATA_TEST_ID.CONTENT}>{children}</CardContent>
      {footnote && (
        <CardFooter className="border-t pt-4">
          <p
            data-testid={DATA_TEST_ID.FOOTNOTE}
            className="font-mono text-xs tracking-[2px] text-muted-foreground uppercase"
          >
            {footnote}
          </p>
        </CardFooter>
      )}
    </Card>
  );
}
