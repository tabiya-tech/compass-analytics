import { useState } from "react";
import { addMonths, format, isSameMonth, startOfMonth } from "date-fns";
import { useTranslation } from "react-i18next";
import { CalendarIcon } from "lucide-react";
import type { DateRange as CalendarDateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useFilters } from "@/filters/FiltersContext";

const RANGE_TRIGGER_ID = "time-filter-range";

export interface TimeFilterBarProps {
  showLabels?: boolean;
  showGranularity?: boolean;
}

// Parsed as local-midnight, not UTC — matches how filters.ts's own toIsoDate() formats back out.
function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

interface VisibleMonths {
  left: Date;
  right: Date;
}

// Anchors the two panels on the range's own start and end months — a year-long range should show
// its two ends, not two months squeezed together near the start. Falls back to start+1 when both
// ends land in the same month, so the panels are never showing an identical, redundant month.
function anchorMonths(range: { from: Date; to: Date }): VisibleMonths {
  const left = startOfMonth(range.from);
  const right = startOfMonth(range.to ?? range.from);
  return { left, right: isSameMonth(left, right) ? addMonths(left, 1) : right };
}

export function TimeFilterBar({ showLabels = true, showGranularity = true }: Readonly<TimeFilterBarProps>) {
  const { t } = useTranslation();
  const { filters, setDateRange } = useFilters();
  const { start, end } = filters.dateRange;
  const labelClass = showLabels ? undefined : "sr-only";
  const [open, setOpen] = useState(false);
  // Tracks an in-progress pick (first click chosen, second not yet) — kept out of FiltersContext
  // so a half-made selection never triggers a refetch, and so the second click still sees an
  // incomplete range rather than the collapsed single-day range committing it would produce.
  const [pendingRange, setPendingRange] = useState<CalendarDateRange | undefined>(undefined);

  const committedRange = { from: parseIsoDate(start), to: parseIsoDate(end) };
  const [months, setMonths] = useState<VisibleMonths>(() => anchorMonths(committedRange));
  const selected = pendingRange ?? committedRange;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    setPendingRange(undefined);
    if (nextOpen) setMonths(anchorMonths(committedRange));
  }

  function handleSelect(range: CalendarDateRange | undefined) {
    setPendingRange(range);
    if (range?.from && range.to) {
      setDateRange({ start: format(range.from, "yyyy-MM-dd"), end: format(range.to, "yyyy-MM-dd") });
      setOpen(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={RANGE_TRIGGER_ID} className={labelClass}>
          {t("filters.time.rangeLabel")}
        </Label>
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button
              id={RANGE_TRIGGER_ID}
              variant="outline"
              className="justify-start font-normal hover:bg-surface-wash hover:text-foreground"
              aria-label={t("filters.time.rangeLabel")}
            >
              <CalendarIcon className="text-muted-foreground" />
              {format(parseIsoDate(start), "d MMM yyyy")} – {format(parseIsoDate(end), "d MMM yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="flex w-auto divide-x divide-border p-0" align="start">
            {/* Two independently-navigable months, anchored on the range's own start and end
                rather than shown consecutively — a year-long range should show both its ends. */}
            <Calendar
              mode="range"
              captionLayout="dropdown"
              selected={selected}
              month={months.left}
              onMonthChange={(left) => setMonths((prev) => ({ ...prev, left }))}
              onSelect={handleSelect}
              resetOnSelect
            />
            <Calendar
              mode="range"
              captionLayout="dropdown"
              selected={selected}
              month={months.right}
              onMonthChange={(right) => setMonths((prev) => ({ ...prev, right }))}
              onSelect={handleSelect}
              resetOnSelect
            />
          </PopoverContent>
        </Popover>
      </div>
      {showGranularity && (
        <Badge variant="outline" aria-live="polite">
          {t("filters.time.granularityLabel", { granularity: t(`filters.granularity.${filters.granularity}`) })}
        </Badge>
      )}
    </div>
  );
}
