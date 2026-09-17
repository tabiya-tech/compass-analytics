import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, TriangleAlert } from "lucide-react";
import { useAccess } from "@/access/AccessContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePagination } from "@/hooks/usePagination";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { TablePagination } from "@/components/shared/TablePagination";
import { ScreenHead } from "@/components/shared/ScreenHead";
import { StatTile } from "@/components/shared/StatTile";
import type { InstitutionSortKey, InstitutionsSort, InstitutionSummary } from "@/institutions/institutions.types";
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

const PAGE_SIZE = 20;

const SEARCH_DEBOUNCE_MS = 250;

const DEFAULT_SORT: InstitutionsSort = { by: "registered_users", direction: "desc" };

// GET /api/analytics/institutions always returns the full, unfiltered, unsorted portfolio in
// one page (see InstitutionsService) — search, region filtering and sorting for this table
// happen here, client-side, against that full response, the same way pagination already does.
function matchesSearch(institution: InstitutionSummary, search: string): boolean {
  if (!search) return true;
  const needle = search.toLowerCase();
  return institution.name.toLowerCase().includes(needle) || institution.id.toLowerCase().includes(needle);
}

function matchesRegionFilter(institution: InstitutionSummary, regions: readonly string[]): boolean {
  return regions.length === 0 || regions.includes(institution.region);
}

function sortValue(institution: InstitutionSummary, key: InstitutionSortKey): string | number {
  switch (key) {
    case "name":
      return institution.name;
    case "registered_users":
      return institution.registered_users;
    case "active_users":
      return institution.active_users;
    case "skills_reports":
      return institution.skills_reports ?? 0;
    default:
      return institution.module_started_pct[key] ?? 0;
  }
}

function filterAndSortInstitutions(
  institutions: readonly InstitutionSummary[],
  search: string,
  regions: readonly string[],
  sort: InstitutionsSort
): InstitutionSummary[] {
  const filtered = institutions.filter(
    (institution) => matchesSearch(institution, search) && matchesRegionFilter(institution, regions)
  );

  const direction = sort.direction === "asc" ? 1 : -1;
  return filtered.sort((a, b) => {
    const left = sortValue(a, sort.by);
    const right = sortValue(b, sort.by);
    if (typeof left === "string" && typeof right === "string") return left.localeCompare(right) * direction;
    return ((left as number) - (right as number)) * direction;
  });
}

export function Institutions() {
  const { t } = useTranslation();
  const { activeModules } = useAccess();

  const [search, setSearch] = useState("");
  const [regions, setRegions] = useState<string[]>([]);
  const [sort, setSort] = useState<InstitutionsSort>(DEFAULT_SORT);
  const [selectedId, setSelectedId] = useState<string | null>(null); // null closes the modal

  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const state = useInstitutions();
  const detail = useInstitutionDetail(selectedId);

  const filteredAndSorted = useMemo(
    () =>
      state.status === "success"
        ? filterAndSortInstitutions(state.data.items, debouncedSearch.trim(), regions, sort)
        : [],
    [state, debouncedSearch, regions, sort]
  );
  const portfolioSize = filteredAndSorted.length;
  const { page, setPage } = usePagination({
    listIdentity: JSON.stringify([debouncedSearch, regions, sort]),
    pageCount:
      state.status === "success" ? Math.max(1, Math.ceil(portfolioSize / PAGE_SIZE)) : Number.POSITIVE_INFINITY,
  });
  const institutionsOnPage = useMemo(
    () => filteredAndSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredAndSorted, page]
  );

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
    <div className="flex h-svh min-w-0 flex-col gap-6 p-6 pb-0" data-testid={DATA_TEST_ID.CONTAINER}>
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
              {portfolioSize === 1 ? t("institutions.countOne") : t("institutions.count", { value: portfolioSize })}
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <InstitutionsTable
              className="overflow-x-auto overflow-y-auto"
              style={{ maxHeight: `calc(100svh - 428px)` }}
              institutions={institutionsOnPage}
              columns={columns}
              sort={sort}
              onSortChange={setSort}
              regionOptions={regionOptions}
              selectedRegions={regions}
              onSelectedRegionsChange={setRegions}
              onClearFilters={clearFilters}
              onInstitutionSelect={(institution) => setSelectedId(institution.id)}
            />
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={portfolioSize}
              onPageChange={setPage}
              className="shrink-0"
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
