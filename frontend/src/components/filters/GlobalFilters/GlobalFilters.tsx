import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFilters } from "@/filters/FiltersContext";
import { useAccess } from "@/access/AccessContext";
import { AUDIENCE_SEGMENT_LABEL_KEYS, LOGIN_METHOD_LABEL_KEYS, type ChipFilterKey } from "@/filters/filters";
import type { TranslationKey } from "@/i18n/react-i18next";

const FILTER_LABEL_KEYS: Record<ChipFilterKey, TranslationKey> = {
  institutionDrillDownId: "filters.labels.institution",
  audienceSegment: "filters.labels.audienceSegment",
  loginMethod: "filters.labels.loginMethod",
};

/** Values with a translated label. Institution ids aren't in here — they display as-is. */
const VALUE_LABEL_KEYS: Record<string, TranslationKey> = {
  ...AUDIENCE_SEGMENT_LABEL_KEYS,
  ...LOGIN_METHOD_LABEL_KEYS,
};

function FilterChip({
  label,
  value,
  onRemove,
  removeLabel,
}: {
  label: string;
  value: string;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <Badge variant="secondary" className="gap-1 py-1 pr-1 pl-2.5">
      <span>
        {label}: {value}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="rounded-full p-0.5 hover:bg-secondary-foreground/10"
      >
        <X className="size-3" />
      </button>
    </Badge>
  );
}

/** The active non-time filters as removable chips, plus "Clear all". Reusable across screens. */
export function GlobalFilters() {
  const { t } = useTranslation();
  const { activeFilters, clearFilter, clearAll } = useFilters();
  const { isMultiInstitution } = useAccess();

  // Institution drill-down only makes sense for a grant covering more than one institution.
  const chips = activeFilters.filter((f) => f.key !== "institutionDrillDownId" || isMultiInstitution);

  if (chips.length === 0) {
    return <span className="text-sm text-muted-foreground">{t("filters.none")}</span>;
  }

  return (
    <div role="group" aria-label={t("filters.activeLabel")} className="flex flex-wrap items-center gap-2">
      {chips.map(({ key, value }) => {
        const label = t(FILTER_LABEL_KEYS[key]);
        const valueLabelKey = VALUE_LABEL_KEYS[value];
        return (
          <FilterChip
            key={key}
            label={label}
            value={valueLabelKey ? t(valueLabelKey) : value}
            onRemove={() => clearFilter(key)}
            removeLabel={t("filters.remove", { filter: label })}
          />
        );
      })}
      <Button variant="ghost" size="sm" onClick={clearAll}>
        {t("filters.clearAll")}
      </Button>
    </div>
  );
}
