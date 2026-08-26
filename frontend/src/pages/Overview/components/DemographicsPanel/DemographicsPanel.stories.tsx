import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import type { DemographicChart } from "@/analytics/analytics.types";
import { DemographicsPanel } from "./DemographicsPanel";

const EXAMPLE_DEMOGRAPHIC_CHARTS: DemographicChart[] = [
  {
    type: "pie-chart",
    name: "gender",
    items: [
      { name: "female", value: 6_190 },
      { name: "male", value: 5_820 },
      { name: "other", value: 440 },
    ],
  },
  {
    type: "horizontal-bar-chart",
    name: "region",
    items: [
      { name: "Lusaka", value: 4_190 },
      { name: "Copperbelt", value: 3_040 },
      { name: "Southern", value: 2_350 },
      { name: "Eastern", value: 1_640 },
      { name: "Central", value: 1_230 },
    ],
  },
];

const meta = {
  component: DemographicsPanel,
  tags: ["autodocs"],
  args: { charts: EXAMPLE_DEMOGRAPHIC_CHARTS },
  decorators: [
    (Story) => (
      <div className="w-260 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DemographicsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullProfile: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelectorAll(".recharts-sector")).toHaveLength(3);
    await expect(canvas.getByRole("list", { name: "Region" })).toBeVisible();
  },
};

export const WithoutRegion: Story = {
  args: { charts: [EXAMPLE_DEMOGRAPHIC_CHARTS[0]] },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("list", { name: "Region" })).not.toBeInTheDocument();
  },
};

export const Empty: Story = {
  args: { charts: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No data to show for this selection.")).toBeVisible();
  },
};

export const Degraded: Story = {
  args: { charts: [], degraded: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("We couldn't load demographic data right now.")).toBeVisible();
  },
};

/** One chart came through fine; another (e.g. region) failed validation upstream and was dropped. */
export const PartiallyDegraded: Story = {
  args: { charts: [EXAMPLE_DEMOGRAPHIC_CHARTS[0]], degraded: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Some demographic data couldn't be loaded right now.")).toBeVisible();
    await expect(canvas.getByRole("img", { name: "Jobseekers by gender" })).toBeVisible();
  },
};
