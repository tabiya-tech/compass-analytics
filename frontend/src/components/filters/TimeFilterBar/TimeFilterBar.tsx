import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useFilters } from "@/filters/FiltersContext";

const START_INPUT_ID = "time-filter-start";
const END_INPUT_ID = "time-filter-end";

export interface TimeFilterBarProps {
  showLabels?: boolean;
  showGranularity?: boolean;
}

export function TimeFilterBar({ showLabels = true, showGranularity = true }: Readonly<TimeFilterBarProps>) {
  const { t } = useTranslation();
  const { filters, setDateRange } = useFilters();
  const { start, end } = filters.dateRange;
  const labelClass = showLabels ? undefined : "sr-only";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={START_INPUT_ID} className={labelClass}>
          {t("filters.time.startLabel")}
        </Label>
        <Input
          id={START_INPUT_ID}
          type="date"
          value={start}
          max={end}
          onChange={(event) => setDateRange({ start: event.target.value, end })}
        />
      </div>
      {!showLabels && (
        <span aria-hidden="true" className="self-center text-muted-foreground">
          –
        </span>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor={END_INPUT_ID} className={labelClass}>
          {t("filters.time.endLabel")}
        </Label>
        <Input
          id={END_INPUT_ID}
          type="date"
          value={end}
          min={start}
          onChange={(event) => setDateRange({ start, end: event.target.value })}
        />
      </div>
      {showGranularity && (
        <Badge variant="outline" aria-live="polite">
          {t("filters.time.granularityLabel", { granularity: t(`filters.granularity.${filters.granularity}`) })}
        </Badge>
      )}
    </div>
  );
}
