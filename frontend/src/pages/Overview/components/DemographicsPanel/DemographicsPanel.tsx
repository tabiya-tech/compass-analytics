import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { DonutChart } from "@/components/charts/DonutChart";
import { HBar } from "@/components/charts/HBar";
import { Panel } from "@/components/shared/Panel";
import { seriesColorAt } from "@/components/charts/chart-palette";
import type { Demographics, GenderId } from "@/pages/Overview/overview.types";

const uniqueId = "a41f8e63-27b0-4c95-8d1e-6f30b95c7a24";

export const DATA_TEST_ID = {
  CONTAINER: `demographics-panel-container-${uniqueId}`,
  SECTION: `demographics-panel-section-${uniqueId}`,
};

const GENDER_DONUT_SIZE = 140;

/** Age and region read as reach, in green; education is set apart in navy. */
const AGE_BAND_COLOR = seriesColorAt(1);
const EDUCATION_COLOR = seriesColorAt(2);
const REGION_COLOR = seriesColorAt(0);

/** Fixed by gender, not by array position — the palette's first two slots are both greens. */
const GENDER_COLORS: Record<GenderId, string> = {
  women: seriesColorAt(1), // green
  men: seriesColorAt(2), // blue
  undisclosed: seriesColorAt(3), // grey
};

export interface DemographicsPanelProps {
  demographics: Demographics;
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

/** Gender as a share; age, education and region as counts. The four aren't comparable, so each keeps its own scale. */
export function DemographicsPanel({ demographics, isLoading = false }: Readonly<DemographicsPanelProps>) {
  const { t } = useTranslation();

  const genderSlices = demographics.gender.map((bucket) => ({
    id: bucket.id,
    label: t(`overview.demographics.genders.${bucket.id}`),
    value: bucket.users,
    color: GENDER_COLORS[bucket.id],
  }));

  const ageBandItems = demographics.ageBands.map((bucket) => ({
    id: bucket.id,
    label: t(`overview.demographics.ageBands.${bucket.id}`),
    value: bucket.users,
  }));

  const educationItems = demographics.educationLevels.map((bucket) => ({
    id: bucket.id,
    label: t(`overview.demographics.educationLevels.${bucket.id}`),
    value: bucket.users,
  }));

  const regionItems = demographics.regions.map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    value: bucket.users,
  }));

  return (
    <Panel
      testId={DATA_TEST_ID.CONTAINER}
      title={t("overview.demographics.title")}
      description={t("overview.demographics.description")}
      isLoading={isLoading}
    >
      <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
        <Section label={t("overview.demographics.sections.gender")}>
          <DonutChart
            label={t("overview.demographics.genderChartLabel")}
            slices={genderSlices}
            size={GENDER_DONUT_SIZE}
          />
        </Section>
        <Section label={t("overview.demographics.sections.ageBand")}>
          <HBar label={t("overview.demographics.sections.ageBand")} items={ageBandItems} color={AGE_BAND_COLOR} />
        </Section>
        <Section label={t("overview.demographics.sections.education")}>
          <HBar label={t("overview.demographics.sections.education")} items={educationItems} color={EDUCATION_COLOR} />
        </Section>
        <Section label={t("overview.demographics.sections.region")}>
          <HBar label={t("overview.demographics.sections.region")} items={regionItems} color={REGION_COLOR} />
        </Section>
      </div>
    </Panel>
  );
}
