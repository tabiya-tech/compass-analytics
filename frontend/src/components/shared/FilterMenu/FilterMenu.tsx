import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const uniqueId = "21dfbbd5-171d-4103-ac3e-ca390a3b6c0c";

export const DATA_TEST_ID = {
  TRIGGER: `filter-menu-trigger-${uniqueId}`,
  CONTENT: `filter-menu-content-${uniqueId}`,
  CLEAR_BUTTON: `filter-menu-clear-button-${uniqueId}`,
};

export interface FilterMenuOption {
  value: string;
  label: string;
}

export interface FilterMenuProps {
  label: string;
  options: readonly FilterMenuOption[];
  selected: readonly string[];
  onSelectionChange: (selected: string[]) => void;
  showLabel?: boolean;
  className?: string;
}

export function FilterMenu({
  label,
  options,
  selected,
  onSelectionChange,
  showLabel = true,
  className,
}: Readonly<FilterMenuProps>) {
  const { t } = useTranslation();
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const selectedCount = selected.length;
  const menuLabel = t("shared.filterMenu.trigger", { label });

  const toggle = (value: string) => {
    const next = selected.includes(value) ? selected.filter((option) => option !== value) : [...selected, value];
    onSelectionChange(next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={showLabel ? "sm" : "icon-xs"}
          aria-label={menuLabel}
          data-testid={DATA_TEST_ID.TRIGGER}
          className={cn(showLabel && "gap-2", className)}
        >
          {showLabel && (
            <>
              <span className="font-mono text-xs tracking-[2px] text-muted-foreground uppercase">{label}</span>
              {selectedCount > 0 && (
                <Badge variant="secondary" aria-hidden="true">
                  {selectedCount}
                </Badge>
              )}
            </>
          )}
          {/* Always the last child, so the icon sits at the end of the label, never before it. */}
          <Filter aria-hidden="true" className={cn(selectedCount > 0 ? "text-foreground" : "text-muted-foreground")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" aria-label={menuLabel} data-testid={DATA_TEST_ID.CONTENT} className="w-72 p-0">
        <fieldset aria-labelledby={headingId} className="grid gap-0.5 pb-2">
          <p id={headingId} className="px-4 pt-4 pb-2 font-mono text-xs tracking-[2px] text-muted-foreground uppercase">
            {t("shared.filterMenu.heading", { label })}
          </p>
          {options.length === 0 ? (
            <p className="px-4 py-1.5 text-sm text-muted-foreground">{t("shared.filterMenu.noOptions")}</p>
          ) : (
            options.map((option) => {
              const optionId = `${baseId}-${option.value}`;
              return (
                <Label
                  key={option.value}
                  htmlFor={optionId}
                  className="cursor-pointer gap-3 rounded-md px-4 py-2 font-normal hover:bg-accent hover:text-accent-foreground"
                >
                  <Checkbox
                    id={optionId}
                    checked={selected.includes(option.value)}
                    onCheckedChange={() => toggle(option.value)}
                  />
                  <span className="truncate text-foreground">{option.label}</span>
                </Label>
              );
            })
          )}
        </fieldset>
        {selectedCount > 0 && (
          <>
            <Separator />
            <div className="flex items-center justify-between gap-2 p-2">
              <span className="pl-2 text-xs text-muted-foreground">
                {t("shared.filterMenu.selectedCount", { value: selectedCount })}
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onSelectionChange([])}
                data-testid={DATA_TEST_ID.CLEAR_BUTTON}
              >
                {t("shared.filterMenu.clear")}
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
