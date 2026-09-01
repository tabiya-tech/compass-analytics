import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { DonutChart } from "@/components/charts/DonutChart";
import { HBar } from "@/components/charts/HBar";
import { seriesColorAt } from "@/components/charts/chart-palette";
import { EmptyState } from "@/components/shared/EmptyState";
import { Panel } from "@/components/shared/Panel";
import { Skeleton } from "@/components/ui/skeleton";
import type { DemographicChart } from "@/analytics/analytics.types";
import type { TranslationKey } from "@/i18n/react-i18next";

type Translate = ReturnType<typeof useTranslation>["t"];

const uniqueId = "a41f8e63-27b0-4c95-8d1e-6f30b95c7a24";

export const DATA_TEST_ID = {
  CONTAINER: `demographics-panel-container-${uniqueId}`,
  SECTION: `demographics-panel-section-${uniqueId}`,
  DEGRADED: `demographics-panel-degraded-${uniqueId}`,
  LOADING: `demographics-panel-loading-${uniqueId}`,
};

const REGION_COLOR = seriesColorAt(0);

/**
 * One entry per demographic dimension the frontend knows how to render, keyed by the
 * chart's `name`. A dimension not listed here (a future one the backend has started
 * sending but the frontend hasn't caught up to yet) is simply skipped — see `chartsToRender`.
 *
 * `valueKeys` translates a small, known vocabulary of item values (e.g. gender); a
 * dimension without one (e.g. region) shows the raw data value — those are proper
 * nouns, not app copy, and can't be enumerated in a translation file.
 *
 * `chartLabel` gives the chart component its own accessible name, distinct from the
 * section heading — a donut chart also renders a visually-hidden data table captioned
 * with that name, so reusing the section heading text would duplicate it on the page.
 *
 * `sliceColors` fixes a pie-chart dimension's colors by value rather than by array
 * position — the palette's first two slots are both green, so two slices next to each
 * other would otherwise risk being visually indistinguishable.
 */
interface ChartDimensionConfig {
  titleKey: TranslationKey;
  chartLabel?: TranslationKey;
  valueKeys?: Record<string, TranslationKey>;
  sliceColors?: Record<string, string>;
}

const CHART_DIMENSIONS: Record<string, ChartDimensionConfig> = {
  gender: {
    titleKey: "graphs.gender.label",
    chartLabel: "graphs.gender.chartLabel",
    valueKeys: {
      female: "graphs.gender.value.female",
      male: "graphs.gender.value.male",
      other: "graphs.gender.value.other",
    },
    sliceColors: {
      female: seriesColorAt(1),
      male: seriesColorAt(2),
      other: seriesColorAt(3),
    },
  },
  region: {
    titleKey: "graphs.region.label",
  },
  // TODO(CORE-672): age band and education aren't queryable upstream yet (see
  // compass-connect's demographics repository) — add their translation keys and
  // uncomment once the backend starts sending an "age-band"/"education" chart:
  // "age-band": { titleKey: "graphs.ageBand.label" },
  // education: { titleKey: "graphs.education.label" },
};

export interface DemographicsPanelProps {
  charts: readonly DemographicChart[];
  degraded?: boolean;
  isLoading?: boolean;
}

function Section({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div data-testid={DATA_TEST_ID.SECTION} className="grid content-start gap-3">
      <p className="font-mono text-xs tracking-[2px] text-green-3 uppercase">{label}</p>
      {children}
    </div>
  );
}

function itemLabel(valueKeys: Record<string, TranslationKey> | undefined, itemName: string, t: Translate): string {
  const key = valueKeys?.[itemName];
  return key ? t(key) : itemName;
}

/** Shown while the first fetch is in flight, so "loading" never reads as "no data". */
function DemographicsSkeleton() {
  return (
    <div data-testid={DATA_TEST_ID.LOADING} className="grid gap-x-10 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
      <Skeleton className="h-48 rounded-card" />
      <Skeleton className="h-48 rounded-card" />
    </div>
  );
}

/** Renders whatever charts the backend currently sends, generically: `type` picks the chart component, `name` picks its labels. */
export function DemographicsPanel({ charts, degraded = false, isLoading = false }: Readonly<DemographicsPanelProps>) {
  const { t } = useTranslation();

  // Only show charts that have data.
  const chartsToRender = charts.filter(
    (chart) => Object.hasOwn(CHART_DIMENSIONS, chart.name) && chart.items.some((item) => item.value > 0)
  );

  return (
    <Panel
      testId={DATA_TEST_ID.CONTAINER}
      title={t("overview.demographics.title")}
      description={t("overview.demographics.description")}
      isLoading={isLoading}
    >
      {isLoading ? (
        <DemographicsSkeleton />
      ) : chartsToRender.length === 0 ? (
        <div data-testid={degraded ? DATA_TEST_ID.DEGRADED : undefined}>
          <EmptyState message={t(degraded ? "overview.demographics.degraded" : "charts.empty")} />
        </div>
      ) : (
        <>
          {/* Some data is still worth showing, so flag the failure instead of hiding it. */}
          {degraded && (
            <p data-testid={DATA_TEST_ID.DEGRADED} role="status" className="mb-4 text-sm text-muted-foreground">
              {t("overview.demographics.degradedPartial")}
            </p>
          )}
          <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
            {chartsToRender.map((chart) => {
              const config = CHART_DIMENSIONS[chart.name];
              const title = t(config.titleKey);
              const items = chart.items.map((item, index) => ({
                id: item.name,
                label: itemLabel(config.valueKeys, item.name, t),
                value: item.value,
                // +1 skips the palette's greenest slot even for a value with no fixed color.
                color: config.sliceColors?.[item.name] ?? seriesColorAt(index + 1),
              }));

              return (
                <Section key={chart.name} label={title}>
                  {chart.type === "pie-chart" ? (
                    <DonutChart label={t(config.chartLabel ?? config.titleKey)} slices={items} size={140} />
                  ) : (
                    <HBar label={title} items={items} color={REGION_COLOR} />
                  )}
                </Section>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}
