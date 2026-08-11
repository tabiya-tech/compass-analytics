import { useTranslation } from "react-i18next";
import { BarChart } from "@/components/charts/BarChart";
import { TimeFilterBar } from "@/components/filters/TimeFilterBar";
import { Panel } from "@/components/shared/Panel";
import type { ReachPoint } from "@/pages/Overview/overview.types";
import { formatPeriodLabel } from "@/pages/Overview/utils";
import type { Granularity } from "@/filters/filters";

const uniqueId = "b7c41d08-3f52-4ea6-9c17-58d2b0e6a934";

export const DATA_TEST_ID = {
  CONTAINER: `reach-over-time-panel-container-${uniqueId}`,
};

export const SERIES_IDS = {
  NEW_USERS: "new-users",
  RETURNING_USERS: "returning-users",
} as const;

const CHART_HEIGHT = 320;

export interface ReachOverTimePanelProps {
  reachSeries: readonly ReachPoint[];
  granularity: Granularity; // derived from the date range, never set here
  isLoading?: boolean;
  className?: string;
}

/** New against returning users over the selected window — the panel's time filter writes to shared state, so it moves every other panel too. */
export function ReachOverTimePanel({
  reachSeries,
  granularity,
  isLoading = false,
  className,
}: Readonly<ReachOverTimePanelProps>) {
  const { t } = useTranslation();
  const granularityLabel = t(`filters.granularity.${granularity}`);

  const categories = reachSeries.map((point) => formatPeriodLabel(point.period, granularity));
  const series = [
    {
      id: SERIES_IDS.NEW_USERS,
      label: t("overview.reach.newUsers"),
      values: reachSeries.map((point) => point.newUsers),
    },
    {
      id: SERIES_IDS.RETURNING_USERS,
      label: t("overview.reach.returningUsers"),
      values: reachSeries.map((point) => point.returningUsers),
    },
  ];

  return (
    <Panel
      testId={DATA_TEST_ID.CONTAINER}
      title={t("overview.reach.title")}
      description={t("overview.reach.description", { granularity: granularityLabel })}
      action={<TimeFilterBar showLabels={false} showGranularity={false} />}
      className={className}
    >
      <BarChart
        label={t("overview.reach.chartLabel", { granularity: granularityLabel })}
        categories={categories}
        series={series}
        stacked
        isLoading={isLoading}
        height={CHART_HEIGHT}
      />
    </Panel>
  );
}
