import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MODULE_IDS, useAccess } from "@/access/AccessContext";
import { routerPaths } from "@/app/routerPaths";
import { EmptyState } from "@/components/shared/EmptyState";
import { ScreenHead } from "@/components/shared/ScreenHead";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleBody } from "@/pages/Modules/components/ModuleBody";
import { ModuleHeader } from "@/pages/Modules/components/ModuleHeader";
import { ModuleTimeline } from "@/pages/Modules/components/ModuleTimeline";
import { useModuleMetrics } from "@/pages/Modules/hooks/use-module-metrics";
import { useJobReadiness } from "@/pages/Modules/hooks/use-job-readiness";
import type { ModuleMetrics } from "@/pages/Modules/types";
import { moduleSectionElementId, rendersModulesInline } from "@/pages/Modules/utils";
import { formatDateRangeLabel } from "@/pages/Overview/utils";

const uniqueId = "2e94b7f0-6a58-4c31-bd27-90e4a1c8536d";

export const DATA_TEST_ID = {
  CONTAINER: `modules-container-${uniqueId}`,
  SECTION: `modules-section-${uniqueId}`,
  LOADING: `modules-loading-${uniqueId}`,
  ERROR: `modules-error-${uniqueId}`,
  STALE_WARNING: `modules-stale-warning-${uniqueId}`,
};

const PADDING = "px-6 md:px-10";

function ModulesSkeleton() {
  return (
    <div data-testid={DATA_TEST_ID.LOADING} className={`grid gap-8 ${PADDING}`}>
      <Skeleton className="h-28 rounded-card" />
      <Skeleton className="h-16 w-96 max-w-full rounded-card" />
      <div className="grid gap-6 sm:grid-cols-2">
        <Skeleton className="h-36 rounded-card" />
        <Skeleton className="h-36 rounded-card" />
      </div>
      <Skeleton className="h-96 rounded-card" />
    </div>
  );
}

/**
 * Every deployed module's figures on one screen, in deployment order, under a
 * timeline that jumps between them. A single-module deployment never gets here:
 * Overview carries its module instead.
 */
export function Modules() {
  const { t } = useTranslation();
  const { activeModules } = useAccess();
  // Skip fetch on single-module deployments that redirect to Overview.
  const { metrics, isModuleLoading, error, reload } = useModuleMetrics({
    enabled: !rendersModulesInline(activeModules),
  });
  const jobReadinessState = useJobReadiness();

  // When the real job-readiness endpoint returns data, substitute it in; otherwise
  // the mock-backed module metrics entry is used as a fallback so the screen still renders.
  function mergeJobReadiness(modules: readonly ModuleMetrics[]): readonly ModuleMetrics[] {
    if (jobReadinessState.status !== "success") return modules;
    const { data } = jobReadinessState;
    return modules.map((module) =>
      module.moduleId === MODULE_IDS.JOB_READINESS
        ? {
            moduleId: MODULE_IDS.JOB_READINESS,
            startedPercentage: data.started_percentage,
            subModules: data.sub_modules,
          }
        : module
    );
  }

  if (rendersModulesInline(activeModules)) return <Navigate to={routerPaths.ROOT} replace />;

  return (
    // The shell's SidebarInset is the page's <main>, so this is a section of it.
    <div data-testid={DATA_TEST_ID.CONTAINER} className="grid content-start gap-8 pb-10">
      <div className={`pt-8 md:pt-10 ${PADDING}`}>
        <ScreenHead
          eyebrow={t("modules.eyebrow")}
          title={t("modules.title")}
          description={
            metrics ? t("modules.description", { range: formatDateRangeLabel(metrics.dateRange) }) : undefined
          }
        />
      </div>

      {metrics && metrics.modules.length > 0 && (
        <ModuleTimeline
          className={PADDING}
          modules={mergeJobReadiness(metrics.modules).map((module) => ({
            id: module.moduleId,
            startedPercentage: module.startedPercentage,
          }))}
        />
      )}

      {/* A failed refetch keeps the last good figures on screen, and says so alongside them. */}
      {error && metrics && (
        <p role="alert" data-testid={DATA_TEST_ID.STALE_WARNING} className={`text-sm text-destructive ${PADDING}`}>
          {t("modules.error")}
        </p>
      )}

      {error && !metrics && (
        <div data-testid={DATA_TEST_ID.ERROR} className={PADDING}>
          <EmptyState message={t("modules.error")} action={{ label: t("common.retry"), onClick: reload }} />
        </div>
      )}

      {!metrics && !error && <ModulesSkeleton />}

      {metrics &&
        mergeJobReadiness(metrics.modules).map((module) => (
          <section
            key={module.moduleId}
            id={moduleSectionElementId(module.moduleId)}
            data-testid={DATA_TEST_ID.SECTION}
            data-module={module.moduleId}
            // Jumped-to sections stop below the sticky timeline rather than under it.
            className={`grid scroll-mt-36 content-start gap-6 pt-6 ${PADDING}`}
          >
            <ModuleHeader moduleId={module.moduleId} />
            <ModuleBody metrics={module} isLoading={isModuleLoading(module.moduleId)} />
          </section>
        ))}
    </div>
  );
}
