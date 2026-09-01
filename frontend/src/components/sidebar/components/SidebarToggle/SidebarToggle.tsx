import { useTranslation } from "react-i18next";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const uniqueId = "860ce4d6-0327-4e0c-9216-521d829c967c";

export const DATA_TEST_ID = {
  BUTTON: `sidebar-toggle-button-${uniqueId}`,
};

export function SidebarToggle({ className }: Readonly<{ className?: string }>) {
  const { t } = useTranslation();
  const { state, toggleSidebar } = useSidebar();

  const sidebarIsExpanded = state === "expanded";
  const label = t(sidebarIsExpanded ? "nav.sidebar.collapse" : "nav.sidebar.expand");
  const Icon = sidebarIsExpanded ? PanelLeftClose : PanelLeftOpen;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid={DATA_TEST_ID.BUTTON}
          aria-label={label}
          aria-expanded={sidebarIsExpanded}
          onClick={toggleSidebar}
          className={cn("size-8 shrink-0 rounded-sm", className)}
        >
          <Icon className="size-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
