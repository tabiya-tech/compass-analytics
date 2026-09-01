import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, TriangleAlert } from "lucide-react";
import { useAccess } from "@/access/AccessContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { ScreenHead } from "@/components/shared/ScreenHead";
import { StatTile } from "@/components/shared/StatTile";
import type { InstitutionsQuery, InstitutionsSort } from "@/institutions/institutions.types";
import { getInstitutionColumns } from "@/pages/Institutions/components/InstitutionsTable/columns";
import { InstitutionsTable } from "@/pages/Institutions/components/InstitutionsTable";
import { InstitutionModal } from "@/pages/Institutions/components/InstitutionModal";
import { InstitutionsSkeleton } from "@/pages/Institutions/components/InstitutionsSkeleton";
import { useInstitutionDetail } from "@/pages/Institutions/hooks/useInstitutionDetail";
import { useInstitutions } from "@/pages/Institutions/hooks/useInstitutions";

const uniqueId = "0a3f5c81-9d2e-4b16-8f47-3c5ea27d61b9";

export const DATA_TEST_ID = {
  CONTAINER: `institutions-container-${uniqueId}`,
  STATS: `institutions-stats-${uniqueId}`,
  SEARCH: `institutions-search-${uniqueId}`,
  COUNT: `institutions-count-${uniqueId}`,
  ERROR: `institutions-error-${uniqueId}`,
};

const PAGE_SIZE = 50;

const SEARCH_DEBOUNCE_MS = 250;

const DEFAULT_SORT: InstitutionsSort = { by: "registered_users", direction: "desc" };

export function Institutions() {
  const { t } = useTranslation();
  const { activeModules } = useAccess();

  const [search, setSearch] = useState("");
  const [regions, setRegions] = useState<string[]>([]);
  const [sort, setSort] = useState<InstitutionsSort>(DEFAULT_SORT);
  const [selectedId, setSelectedId] = useState<string | null>(null); // null closes the modal

  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const query = useMemo<InstitutionsQuery>(
    () => ({ search: debouncedSearch.trim() || undefined, regions, sort, page: 1, page_size: PAGE_SIZE }),
    [debouncedSearch, regions, sort]
  );
  const state = useInstitutions(query);
  const detail = useInstitutionDetail(selectedId);

  const columns = useMemo(() => getInstitutionColumns(activeModules), [activeModules]);
  const regionOptions = useMemo(
    () =>
      state.status === "success"
        ? state.data.available_regions.map((region) => ({ value: region, label: region }))
        : [],
    [state]
  );

  const clearFilters = () => {
    setSearch("");
    setRegions([]);
  };

  return (
    <div className="flex h-svh min-w-0 flex-col gap-6 p-6 pb-8" data-testid={DATA_TEST_ID.CONTAINER}>
      <ScreenHead
        className="shrink-0"
        eyebrow={t("institutions.eyebrow")}
        title={t("institutions.title")}
        description={t("institutions.description")}
      />

      {state.status === "loading" && (
        <InstitutionsSkeleton columns={columns.length} className="min-h-64 overflow-hidden" />
      )}

      {state.status === "error" && (
        <div data-testid={DATA_TEST_ID.ERROR}>
          <EmptyState
            icon={<TriangleAlert />}
            message={t("institutions.error")}
            action={{ label: t("common.retry"), onClick: state.retry }}
          />
        </div>
      )}

      {state.status === "success" && (
        <>
          {/* Portfolio-wide figures — the search and filters below don't move them. */}
          <div className="grid min-w-0 shrink-0 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid={DATA_TEST_ID.STATS}>
            <StatTile
              tone="inverse"
              className="min-w-0"
              value={state.data.totals.jobseekers_reached.toLocaleString()}
              caption={t("institutions.stats.jobseekersReached")}
            />
            <StatTile
              tone="inverse"
              className="min-w-0"
              value={state.data.totals.skills_reports.toLocaleString()}
              caption={t("institutions.stats.skillsReports")}
            />
            <StatTile
              tone="inverse"
              className="min-w-0"
              value={state.data.totals.institutions.toLocaleString()}
              caption={t("institutions.stats.institutions")}
            />
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label={t("institutions.search.label")}
                placeholder={t("institutions.search.placeholder")}
                data-testid={DATA_TEST_ID.SEARCH}
                className="h-11 rounded-pill pl-11"
              />
            </div>
            <p
              data-testid={DATA_TEST_ID.COUNT}
              className="font-mono text-xs tracking-[2px] text-muted-foreground uppercase"
            >
              {/* Two keys rather than a plural rule, so a single match doesn't read "1 institutions". */}
              {state.data.total === 1
                ? t("institutions.countOne")
                : t("institutions.count", { value: state.data.total })}
            </p>
          </div>

          <div className="flex min-h-64 min-w-0 flex-1 flex-col">
            <InstitutionsTable
              className="min-h-0"
              institutions={state.data.items}
              columns={columns}
              sort={sort}
              onSortChange={setSort}
              regionOptions={regionOptions}
              selectedRegions={regions}
              onSelectedRegionsChange={setRegions}
              onClearFilters={clearFilters}
              onInstitutionSelect={(institution) => setSelectedId(institution.id)}
            />
          </div>
        </>
      )}

      <InstitutionModal
        open={selectedId !== null}
        state={detail}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </div>
  );
}
