import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Search, TriangleAlert } from "lucide-react";
import { useAccess, type ModuleId } from "@/access/AccessContext";
import { MODULE_LABEL_KEYS, MODULE_ORDER } from "@/access/moduleDisplay";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { ScreenHead } from "@/components/shared/ScreenHead";
import type {
  JobseekerDetail,
  JobseekerSummary,
  JobseekersQuery,
  JobseekersSort,
  ModuleStatusFilters,
} from "@/jobseekers/jobseekers.types";
import { MODULE_STATUSES } from "@/jobseekers/jobseekers.types";
import { buildJobseekersCsv, downloadCsv, jobseekersCsvFilename } from "@/pages/JobSeekers/csv";
import { MODULE_STATUS_LABEL_KEYS } from "@/pages/JobSeekers/utils";
import { getJobseekerColumns, JobseekersTable } from "@/pages/JobSeekers/components/JobseekersTable";
import { JobseekersSkeleton } from "@/pages/JobSeekers/components/JobseekersSkeleton";
import { ProfileModal } from "@/pages/JobSeekers/components/ProfileModal";
import { SkillsModal } from "@/pages/JobSeekers/components/SkillsModal";
import { useJobseekerDetail } from "@/pages/JobSeekers/hooks/useJobseekerDetail";
import { useJobseekers } from "@/pages/JobSeekers/hooks/useJobseekers";

const uniqueId = "2c7be4a0-9f13-4d68-b5a1-e07d4c6913f8";

export const DATA_TEST_ID = {
  CONTAINER: `jobseekers-container-${uniqueId}`,
  SEARCH: `jobseekers-search-${uniqueId}`,
  COUNT: `jobseekers-count-${uniqueId}`,
  EXPORT: `jobseekers-export-${uniqueId}`,
  ERROR: `jobseekers-error-${uniqueId}`,
};

/** The roster is one institution's cohort — a page is a scroll, not a pager. */
const PAGE_SIZE = 100;

const SEARCH_DEBOUNCE_MS = 250;

const DEFAULT_SORT: JobseekersSort = { by: "name", direction: "asc" };

/** Whichever skills list the user asked for — from a roster row, or from inside a profile. */
type SkillsSelection = { name: string; skills: readonly string[] } | null;

export function Jobseekers() {
  const { t } = useTranslation();
  const { activeModules, scope } = useAccess();

  const [search, setSearch] = useState("");
  const [moduleStatusFilters, setModuleStatusFilters] = useState<ModuleStatusFilters>({});
  const [sort, setSort] = useState<JobseekersSort>(DEFAULT_SORT);
  const [selectedId, setSelectedId] = useState<string | null>(null); // null closes the profile
  const [skillsSelection, setSkillsSelection] = useState<SkillsSelection>(null);

  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const query = useMemo<JobseekersQuery>(
    () => ({
      // The grant travels with every request, so the endpoint is never asked a wider question
      // than the user may have answered. It re-checks it against the token regardless.
      scope,
      search: debouncedSearch.trim() || undefined,
      module_status: moduleStatusFilters,
      sort,
      page: 1,
      page_size: PAGE_SIZE,
    }),
    [scope, debouncedSearch, moduleStatusFilters, sort]
  );
  const state = useJobseekers(query);
  const detail = useJobseekerDetail(selectedId);

  const columns = useMemo(() => getJobseekerColumns(activeModules), [activeModules]);
  // Memoized so the export callback below has a stable identity between renders.
  const jobseekers = useMemo(() => (state.status === "success" ? state.data.items : []), [state]);

  const clearFilters = () => {
    setSearch("");
    setModuleStatusFilters({});
  };

  // The file is built from the rows on screen — same order, same filters, same columns.
  const exportCsv = useCallback(() => {
    if (jobseekers.length === 0) return;
    const csv = buildJobseekersCsv(jobseekers, exportModules(activeModules), {
      id: t("jobseekers.csv.id"),
      name: t("jobseekers.table.columns.name"),
      institution: t("jobseekers.csv.institution"),
      profileScore: t("jobseekers.csv.profileScore"),
      registered: t("jobseekers.table.columns.registered"),
      lastLogin: t("jobseekers.table.columns.lastLogin"),
      skillsReport: t("jobseekers.csv.skillsReport"),
      skillsCount: t("jobseekers.csv.skillsCount"),
      skills: t("jobseekers.table.columns.skills"),
      modules: Object.fromEntries(MODULE_ORDER.map((moduleId) => [moduleId, t(MODULE_LABEL_KEYS[moduleId])])) as Record<
        ModuleId,
        string
      >,
      statuses: Object.fromEntries(
        MODULE_STATUSES.map((status) => [status, t(MODULE_STATUS_LABEL_KEYS[status])])
      ) as Record<(typeof MODULE_STATUSES)[number], string>,
      reportReady: t("jobseekers.csv.ready"),
      reportNotReady: t("jobseekers.csv.notReady"),
    });
    downloadCsv(jobseekersCsvFilename(), csv);
  }, [jobseekers, activeModules, t]);

  const openSkills = (jobseeker: JobseekerSummary | JobseekerDetail) =>
    setSkillsSelection({ name: jobseeker.name, skills: jobseeker.skills });

  return (
    <div className="flex h-svh min-w-0 flex-col gap-6 p-6 pb-8" data-testid={DATA_TEST_ID.CONTAINER}>
      <ScreenHead
        className="shrink-0"
        eyebrow={t("jobseekers.eyebrow")}
        title={t("jobseekers.title")}
        description={t("jobseekers.description")}
      />

      {state.status === "loading" && (
        <JobseekersSkeleton columns={columns.length} className="min-h-64 overflow-hidden" />
      )}

      {state.status === "error" && (
        <div data-testid={DATA_TEST_ID.ERROR}>
          <EmptyState
            icon={<TriangleAlert />}
            message={t("jobseekers.error")}
            action={{ label: t("common.retry"), onClick: state.retry }}
          />
        </div>
      )}

      {state.status === "success" && (
        <>
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
                aria-label={t("jobseekers.search.label")}
                placeholder={t("jobseekers.search.placeholder")}
                data-testid={DATA_TEST_ID.SEARCH}
                className="h-11 rounded-pill pl-11"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <p
                data-testid={DATA_TEST_ID.COUNT}
                className="font-mono text-xs tracking-[2px] text-muted-foreground uppercase"
              >
                {/* Two keys rather than a plural rule, so a single match doesn't read "1 jobseekers". */}
                {state.data.total === 1 ? t("jobseekers.countOne") : t("jobseekers.count", { value: state.data.total })}
              </p>
              <Button
                onClick={exportCsv}
                disabled={jobseekers.length === 0}
                data-testid={DATA_TEST_ID.EXPORT}
                className="rounded-pill"
              >
                <Download aria-hidden="true" />
                {t("jobseekers.export")}
              </Button>
            </div>
          </div>

          <div className="flex min-h-64 min-w-0 flex-1 flex-col">
            <JobseekersTable
              className="min-h-0"
              jobseekers={jobseekers}
              columns={columns}
              sort={sort}
              onSortChange={setSort}
              moduleStatusFilters={moduleStatusFilters}
              onModuleStatusFiltersChange={setModuleStatusFilters}
              onClearFilters={clearFilters}
              onJobseekerSelect={(jobseeker) => setSelectedId(jobseeker.id)}
              onSkillsSelect={openSkills}
            />
          </div>
        </>
      )}

      <ProfileModal
        open={selectedId !== null}
        state={detail}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onViewSkills={openSkills}
      />

      <SkillsModal
        open={skillsSelection !== null}
        name={skillsSelection?.name ?? null}
        skills={skillsSelection?.skills ?? []}
        onOpenChange={(open) => !open && setSkillsSelection(null)}
      />
    </div>
  );
}

/** Suite order, deployed modules only — Jobs included, since the file has room the table doesn't. */
function exportModules(activeModules: readonly ModuleId[]): ModuleId[] {
  return MODULE_ORDER.filter((moduleId) => activeModules.includes(moduleId));
}
