import { useTranslation } from "react-i18next";
import { DonutChart } from "@/components/charts/DonutChart";
import { formatNumber } from "@/components/charts/chart-scale";
import { seriesColorAt } from "@/components/charts/chart-palette";
import { Panel } from "@/components/shared/Panel";
import type { LoginMethodSlice } from "@/pages/Overview/overview.types";
import { LOGIN_METHOD_LABEL_KEYS, type LoginMethodId } from "@/filters/filters";

const uniqueId = "c93a0f27-6b18-4d5e-8a72-14f9c6d3b085";

export const DATA_TEST_ID = {
  CONTAINER: `login-method-panel-container-${uniqueId}`,
  AVERAGE_LOGINS: `login-method-panel-average-logins-${uniqueId}`,
};

/** Fixed by method, not by array position — the palette's first two slots are both greens. */
const LOGIN_METHOD_COLORS: Record<LoginMethodId, string> = {
  google: seriesColorAt(1), // green
  email: seriesColorAt(2), // blue
  anonymous: seriesColorAt(3), // grey
};

export interface LoginMethodPanelProps {
  loginMethods: readonly LoginMethodSlice[];
  averageLoginsPerUser: number;
  isLoading?: boolean;
}

/** How users get in, as a share of the population, with average logins per user in the ring. */
export function LoginMethodPanel({
  loginMethods,
  averageLoginsPerUser,
  isLoading = false,
}: Readonly<LoginMethodPanelProps>) {
  const { t } = useTranslation();

  const slices = loginMethods.map((slice) => ({
    id: slice.method,
    label: t(LOGIN_METHOD_LABEL_KEYS[slice.method]),
    value: slice.users,
    color: LOGIN_METHOD_COLORS[slice.method],
  }));

  return (
    <Panel
      testId={DATA_TEST_ID.CONTAINER}
      title={t("overview.loginMethod.title")}
      description={t("overview.loginMethod.description")}
      footnote={t("overview.loginMethod.footnote")}
      isLoading={isLoading}
    >
      <DonutChart
        label={t("overview.loginMethod.chartLabel")}
        slices={slices}
        centerLabel={formatNumber(averageLoginsPerUser)}
      />
      {/* The ring's centre is decoration to assistive tech, so the figure is stated here too. */}
      <p data-testid={DATA_TEST_ID.AVERAGE_LOGINS} className="sr-only">
        {t("overview.loginMethod.averageLogins")}: {formatNumber(averageLoginsPerUser)}
      </p>
    </Panel>
  );
}
