import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const uniqueId = "6251498c-22bf-46ee-9201-83bcac828359";

export const DATA_TEST_ID = {
  CONTAINER: `empty-state-container-${uniqueId}`,
  ICON: `empty-state-icon-${uniqueId}`,
  ACTION_BUTTON: `empty-state-action-button-${uniqueId}`,
};

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  message: string;
  icon?: ReactNode;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({ message, icon, action, className }: Readonly<EmptyStateProps>) {
  return (
    <div
      data-slot="empty-state"
      data-testid={DATA_TEST_ID.CONTAINER}
      role="status"
      className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}
    >
      <span
        data-slot="empty-state-icon"
        data-testid={DATA_TEST_ID.ICON}
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5"
      >
        {icon ?? <SearchX />}
      </span>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {action && (
        <Button variant="default" size="sm" onClick={action.onClick} data-testid={DATA_TEST_ID.ACTION_BUTTON}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
