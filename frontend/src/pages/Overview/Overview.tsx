import { useTranslation } from "react-i18next";
import { Activity, Clock, Users } from "lucide-react";
import { useAccess, type AccessScope } from "@/access/AccessContext";
import { Sparkline } from "@/components/charts/Sparkline";
import { formatNumber } from "@/components/charts/chart-scale";
import { EmptyState } from "@/components/shared/EmptyState";
import { ScreenHead } from "@/components/shared/ScreenHead";
import { StatTile } from "@/components/shared/StatTile";
import { Skeleton } from "@/components/ui/skeleton";
import { DemographicsPanel } from "@/pages/Overview/components/DemographicsPanel";
import { LoginMethodPanel } from "@/pages/Overview/components/LoginMethodPanel";
import { ReachOverTimePanel } from "@/pages/Overview/components/ReachOverTimePanel";
import type { OverviewMetricsResponse, MetricsScope } from "@/pages/Overview/overview.types";
import { useOverviewMetrics } from "@/pages/Overview/hooks/use-overview-metrics";
import { useDemographics } from "@/pages/Overview/hooks/use-demographics";
import { ModuleBody } from "@/pages/Modules/components/ModuleBody";
import { ModuleHeader } from "@/pages/Modules/components/ModuleHeader";
import { useModuleMetrics } from "@/pages/Modules/hooks/use-module-metrics";
import { findModuleMetrics } from "@/pages/Modules/services/ModuleMetrics.service";
import { soleActiveModule } from "@/pages/Modules/utils";
import { formatDateRangeLabel, formatPeriodLabel } from "@/pages/Overview/utils";

const uniqueId = "f52d7a90-1c6b-48e3-9d47-0b83e6a5c712";

export const DATA_TEST_ID = {
  CONTAINER: `overview-container-${uniqueId}`,
  TILES: `overview-tiles-${uniqueId}`,
  CUMULATIVE_USERS_TILE: `overview-cumulative-users-tile-${uniqueId}`,
  ACTIVE_USERS_TILE: `overview-active-users-tile-${uniqueId}`,
  SESSION_LENGTH_TILE: `overview-session-length-tile-${uniqueId}`,
  LOADING: `overview-loading-${uniqueId}`,
  ERROR: `overview-error-${uniqueId}`,
  STALE_WARNING: `overview-stale-warning-${uniqueId}`,
  INLINE_MODULE: `overview-inline-module-${uniqueId}`,
};

const SPARKLINE_WIDTH = 120;
const SPARKLINE_HEIGHT = 36;

type Translate = ReturnType<typeof useTranslation>["t"];

/** Who the figures cover, over which window. A grant scoped to "all" names no count — every institution in the deployment is covered, not some fixed number of them. */
function describeScope(t: Translate, metrics: OverviewMetricsResponse, accessScope: AccessScope): string {
  const range = formatDateRangeLabel(metrics.dateRange);
  if (metrics.scope.type === "institution") {
    return t("overview.description.institution", { institution: metrics.scope.institutionName, range });
  }
  return accessScope.type === "all"
    ? t("overview.description.portfolioAll", { range })
    : t("overview.description.portfolio", { count: metrics.scope.institutionCount, range });
}

/** Before the first response lands, the grant's own shape is the best available guess. */
function isPortfolioScope(scope: MetricsScope | undefined, isMultiInstitution: boolean): boolean {
  return scope ? scope.type === "portfolio" : isMultiInstitution;
}

function OverviewSkeleton() {
  return (
    <div data-testid={DATA_TEST_ID.LOADING} className="grid gap-6">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {["cumulative", "active", "session"].map((tile) => (
          <Skeleton key={tile} className="h-36 rounded-card" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-96 rounded-card xl:col-span-2" />
        <Skeleton className="h-96 rounded-card" />
      </div>
      <Skeleton className="h-96 rounded-card" />
    </div>
  );
}

/** The default landing screen for anyone with dashboard access — one institution reports on itself, several are aggregated into a portfolio. */
export function Overview() {
  const { t } = useTranslation();
  const { scope, activeModules, isMultiInstitution } = useAccess();
  const { metrics, isLoading, error, reload } = useOverviewMetrics();
  const demographics = useDemographics();
  // A deployment running a single module has no Modules screen — see @/pages/Modules/module-routing.
  const inlineModuleId = soleActiveModule(activeModules);
  const moduleMetrics = useModuleMetrics({ enabled: inlineModuleId !== null });
  const inlineModule =
    inlineModuleId && moduleMetrics.metrics ? findModuleMetrics(moduleMetrics.metrics, inlineModuleId) : null;

  const isPortfolio = isPortfolioScope(metrics?.scope, isMultiInstitution);

  return (
    // The shell's SidebarInset is the page's <main>, so this is a section of it.
    <div data-testid={DATA_TEST_ID.CONTAINER} className="grid content-start gap-5 px-8 pt-8 pb-20">
      <ScreenHead
        eyebrow={t(isPortfolio ? "overview.eyebrow.portfolio" : "overview.eyebrow.institution")}
        title={t("overview.title")}
        description={metrics ? describeScope(t, metrics, scope) : undefined}
      />

      {/* A failed refetch keeps the last good figures on screen, and says so alongside them. */}
      {error && metrics && (
        <p role="alert" data-testid={DATA_TEST_ID.STALE_WARNING} className="text-sm text-destructive">
          {t("overview.error")}
        </p>
      )}

      {error && !metrics && (
        <div data-testid={DATA_TEST_ID.ERROR}>
          <EmptyState message={t("overview.error")} action={{ label: t("common.retry"), onClick: reload }} />
        </div>
      )}

      {!metrics && !error && <OverviewSkeleton />}

      {metrics && (
        <>
          <div data-testid={DATA_TEST_ID.TILES} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 pt-2">
            <div data-testid={DATA_TEST_ID.CUMULATIVE_USERS_TILE}>
              <StatTile
                className="h-full"
                label={t("overview.tiles.cumulativeUsers.label")}
                value={formatNumber(metrics.cumulativeUsers.total)}
                icon={<Users />}
                trend={{
                  value: metrics.cumulativeUsers.growthPercentage,
                  label: t("overview.tiles.cumulativeUsers.trend", {
                    period: formatPeriodLabel(metrics.cumulativeUsers.asOfPeriod, metrics.granularity),
                  }),
                }}
                sparkline={
                  <Sparkline
                    values={metrics.dailySeries.map((point) => point.users)}
                    label={t("overview.tiles.cumulativeUsers.sparkline", {
                      days: metrics.dailySeries.length,
                      from: formatNumber(metrics.dailySeries[0]?.users ?? 0),
                      to: formatNumber(metrics.dailySeries[metrics.dailySeries.length - 1]?.users ?? 0),
                    })}
                    width={SPARKLINE_WIDTH}
                    height={SPARKLINE_HEIGHT}
                    showEndMarker
                  />
                }
              />
            </div>

            <div data-testid={DATA_TEST_ID.ACTIVE_USERS_TILE}>
              <StatTile
                className="h-full"
                label={t("overview.tiles.activeUsers.label")}
                value={formatNumber(metrics.activeUsers.count)}
                icon={<Activity />}
                caption={t("overview.tiles.activeUsers.caption", {
                  share: metrics.activeUsers.shareOfUsersPercentage,
                  days: metrics.activeUsers.windowDays,
                })}
              />
            </div>

            <div data-testid={DATA_TEST_ID.SESSION_LENGTH_TILE}>
              <StatTile
                className="h-full"
                label={t("overview.tiles.avgSession.label")}
                value={t("overview.tiles.avgSession.value", { minutes: metrics.averageSessionMinutes })}
                icon={<Clock />}
                caption={t("overview.tiles.avgSession.caption")}
              />
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <ReachOverTimePanel
              reachSeries={metrics.reachSeries}
              granularity={metrics.granularity}
              isLoading={isLoading}
              className="xl:col-span-2"
            />
            <LoginMethodPanel
              loginMethods={metrics.loginMethods}
              averageLoginsPerUser={metrics.averageLoginsPerUser}
              isLoading={isLoading}
            />
          </div>
        </>
      )}

      <DemographicsPanel
        charts={demographics.status === "success" ? demographics.data.charts : []}
        degraded={demographics.status === "error" || (demographics.status === "success" && demographics.data.degraded)}
        isLoading={demographics.status === "loading"}
      />

      {inlineModule && (
        <section data-testid={DATA_TEST_ID.INLINE_MODULE} data-module={inlineModule.moduleId} className="grid gap-6">
          <ModuleHeader moduleId={inlineModule.moduleId} />
          <ModuleBody metrics={inlineModule} isLoading={moduleMetrics.isModuleLoading(inlineModule.moduleId)} />
        </section>
      )}
    </div>
  );
}
