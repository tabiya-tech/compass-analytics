import { useTranslation } from "react-i18next";
import { Briefcase, Clock, FileText } from "lucide-react";
import { MODULE_IDS } from "@/access/AccessContext";
import { Funnel } from "@/components/charts/Funnel";
import { GaugeBar } from "@/components/charts/GaugeBar";
import { HBar } from "@/components/charts/HBar";
import { ChartLegend } from "@/components/charts/DonutChart/components/ChartLegend";
import {
  CHART_PROGRESS_ACTIVE_COLOR,
  CHART_PROGRESS_DONE_COLOR,
  seriesColorAt,
} from "@/components/charts/chart-palette";
import { formatMinutesDuration, formatNumber } from "@/components/charts/chart-scale";
import { EmptyState } from "@/components/shared/EmptyState";
import { Panel } from "@/components/shared/Panel";
import { StatTile } from "@/components/shared/StatTile";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  BuildYourProfileMetrics,
  CareerExplorerMetrics,
  JobReadinessMetrics,
  JobsMetrics,
  ModuleMetrics,
} from "@/pages/Modules/types";

const uniqueId = "7a2d40e6-cb18-4f93-9e5c-6d81b0a37c25";

export const DATA_TEST_ID = {
  CONTAINER: `module-body-container-${uniqueId}`,
  PANEL: `module-body-panel-${uniqueId}`,
  SUB_MODULE: `module-body-sub-module-${uniqueId}`,
  DEGRADED: `module-body-degraded-${uniqueId}`,
  LOADING: `module-body-loading-${uniqueId}`,
};

export interface ModuleBodyProps {
  metrics: ModuleMetrics;
  isLoading?: boolean;
}

/** Shown while the very first fetch is still pending, before there's anything real to display. */
function BuildYourProfileSkeleton() {
  return (
    <div data-testid={DATA_TEST_ID.LOADING} className="grid gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Skeleton className="h-36 rounded-card" />
        <Skeleton className="h-36 rounded-card" />
      </div>
      <Skeleton className="h-96 rounded-card" />
    </div>
  );
}

function BuildYourProfileBody({
  metrics,
  isLoading,
}: Readonly<{ metrics: BuildYourProfileMetrics; isLoading: boolean }>) {
  const { t } = useTranslation();

  // A zeroed fallback shown as real would read as "nobody uses this" — show the gap instead.
  // `degraded` covers both still-loading and a settled failure; isLoading picks which to render.
  if (metrics.degraded) {
    if (isLoading) return <BuildYourProfileSkeleton />;
    // EmptyState already renders role="status" — no need for a second, conflicting live-region role here.
    return (
      <div data-testid={DATA_TEST_ID.DEGRADED}>
        <EmptyState message={t("modules.buildYourProfile.degraded")} />
      </div>
    );
  }

  const stages = metrics.phases.map((phase) => ({
    id: phase.id,
    label: t(`modules.buildYourProfile.funnel.phases.${phase.id}`),
    value: phase.reached,
  }));

  return (
    <div className="grid gap-6">
      {/* Dims during a refetch, like Panel below, rather than swapping to a skeleton. */}
      <div
        aria-busy={isLoading || undefined}
        className={cn(
          "grid gap-6 sm:grid-cols-2 transition-opacity duration-(--duration-base)",
          isLoading && "opacity-60"
        )}
      >
        <StatTile
          label={t("modules.buildYourProfile.tiles.cvsGenerated.label")}
          value={formatNumber(metrics.cvsGenerated)}
          icon={<FileText />}
          caption={t("modules.buildYourProfile.tiles.cvsGenerated.caption", {
            share: metrics.cvsGeneratedSharePercentage,
          })}
        />
        <StatTile
          label={t("modules.buildYourProfile.tiles.avgTime.label")}
          value={formatMinutesDuration(metrics.averageMinutesToComplete)}
          icon={<Clock />}
          caption={t("modules.buildYourProfile.tiles.avgTime.caption", { target: metrics.targetMinutes })}
        />
      </div>

      <Panel
        testId={DATA_TEST_ID.PANEL}
        title={t("modules.buildYourProfile.funnel.title")}
        description={t("modules.buildYourProfile.funnel.description")}
        isLoading={isLoading}
      >
        <Funnel
          label={t("modules.buildYourProfile.funnel.title")}
          stages={stages}
          valueCaption={t("modules.buildYourProfile.funnel.valueCaption")}
          dropOffCaption={t("charts.funnel.dropOff")}
        />
      </Panel>
    </div>
  );
}

function JobReadinessBody({ metrics, isLoading }: Readonly<{ metrics: JobReadinessMetrics; isLoading: boolean }>) {
  const { t } = useTranslation();

  // Every bar is drawn against the busiest sub-module, so their lengths compare.
  const busiest = Math.max(0, ...metrics.subModules.map((subModule) => subModule.started));
  const completedLabel = t("modules.jobReadiness.progress.legend.completed");
  const startedLabel = t("modules.jobReadiness.progress.legend.started");

  return (
    <Panel
      testId={DATA_TEST_ID.PANEL}
      title={t("modules.jobReadiness.progress.title")}
      description={t("modules.jobReadiness.progress.description")}
      isLoading={isLoading}
      action={
        metrics.subModules.length > 0 ? (
          <ChartLegend
            className="pt-0"
            items={[
              { id: "completed", label: completedLabel, color: CHART_PROGRESS_DONE_COLOR },
              { id: "started", label: startedLabel, color: CHART_PROGRESS_ACTIVE_COLOR },
            ]}
          />
        ) : undefined
      }
    >
      {metrics.subModules.length === 0 ? (
        <EmptyState message={t("modules.jobReadiness.progress.empty")} />
      ) : (
        <ul className="grid gap-6">
          {metrics.subModules.map((subModule) => (
            <li key={subModule.id} data-testid={DATA_TEST_ID.SUB_MODULE} data-sub-module={subModule.id}>
              <GaugeBar
                label={subModule.name}
                value={subModule.completed}
                valueLabel={completedLabel.toLowerCase()}
                secondaryValue={subModule.started}
                secondaryValueLabel={startedLabel.toLowerCase()}
                max={busiest}
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function CareerExplorerBody({ metrics, isLoading }: Readonly<{ metrics: CareerExplorerMetrics; isLoading: boolean }>) {
  const { t } = useTranslation();

  const items = metrics.topSectors.map((sector) => ({
    id: sector.id,
    label: sector.label,
    value: sector.explorations,
  }));

  return (
    <Panel
      testId={DATA_TEST_ID.PANEL}
      title={t("modules.careerExplorer.sectors.title")}
      description={t("modules.careerExplorer.sectors.description")}
      isLoading={isLoading}
    >
      <HBar label={t("modules.careerExplorer.sectors.title")} items={items} color={seriesColorAt(1)} />
    </Panel>
  );
}

function JobsSkeleton() {
  return (
    <div data-testid={DATA_TEST_ID.LOADING} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <Skeleton className="h-36 rounded-card" />
    </div>
  );
}

// profilesWithMatches/jobsViewedPerUser have no real data source yet — only jobsSourced renders.
function JobsBody({ metrics, isLoading }: Readonly<{ metrics: JobsMetrics; isLoading: boolean }>) {
  const { t } = useTranslation();

  // Zeroed data shown as real would misread as "nobody uses this" — show the gap instead.
  if (metrics.degraded) {
    if (isLoading) return <JobsSkeleton />;
    return (
      <div data-testid={DATA_TEST_ID.DEGRADED}>
        <EmptyState message={t("modules.jobs.degraded")} />
      </div>
    );
  }

  return (
    <div
      aria-busy={isLoading || undefined}
      className={cn(
        "grid gap-6 sm:grid-cols-2 lg:grid-cols-3 transition-opacity duration-(--duration-base)",
        isLoading && "opacity-60"
      )}
    >
      <StatTile
        label={t("modules.jobs.tiles.sourced.label")}
        value={formatNumber(metrics.jobsSourced)}
        icon={<Briefcase />}
        caption={t("modules.jobs.tiles.sourced.caption")}
      />
    </div>
  );
}

/**
 * A module's figures. The modules measure different things, so each has its own
 * body; the switch is exhaustive, so a new module type is a compile error here.
 */
export function ModuleBody({ metrics, isLoading = false }: Readonly<ModuleBodyProps>) {
  const body = () => {
    switch (metrics.moduleId) {
      case MODULE_IDS.BUILD_YOUR_PROFILE:
        return <BuildYourProfileBody metrics={metrics} isLoading={isLoading} />;
      case MODULE_IDS.JOB_READINESS:
        return <JobReadinessBody metrics={metrics} isLoading={isLoading} />;
      case MODULE_IDS.CAREER_EXPLORER:
        return <CareerExplorerBody metrics={metrics} isLoading={isLoading} />;
      case MODULE_IDS.JOBS:
        return <JobsBody metrics={metrics} isLoading={isLoading} />;
    }
  };

  return (
    <div data-testid={DATA_TEST_ID.CONTAINER} data-module={metrics.moduleId}>
      {body()}
    </div>
  );
}
