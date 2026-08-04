import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { ChartGrid, ChartXLabels, DATA_TEST_ID } from "./ChartAxes";
import { plotFrom } from "@/components/charts/chart-scale";

// Placeholder data throughout — the real copy is not settled.
const PLOT = plotFrom(480, 220, { top: 20, right: 12, bottom: 28, left: 44 });
const TICKS = [0, 100, 200, 300, 400];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const xOf = (index: number) => PLOT.left + (index / (MONTHS.length - 1)) * PLOT.width;

const meta = {
  component: ChartGrid,
  tags: ["autodocs"],
  args: {
    ticks: TICKS,
    max: 400,
    plot: PLOT,
  },
  decorators: [
    (Story) => (
      <svg className="w-160 max-w-full rounded-card bg-card" viewBox={`0 0 480 220`}>
        <Story />
      </svg>
    ),
  ],
} satisfies Meta<typeof ChartGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Grid: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByTestId(DATA_TEST_ID.Y_TICK)).toHaveLength(TICKS.length);
    await expect(canvas.getByText("400")).toBeVisible();
  },
};

// The two axes are always used together in a real chart — this shows them as
// they'll actually appear, rather than the grid in isolation.
export const WithCategoryLabels: Story = {
  render: (args) => (
    <>
      <ChartGrid {...args} />
      <ChartXLabels labels={MONTHS} plot={PLOT} xOf={xOf} />
    </>
  ),
  play: async ({ canvas }) => {
    // Twelve months don't all fit at ~56px apart, so they're thinned — but the
    // axis still ends on December rather than stopping short.
    await expect(canvas.getAllByTestId(DATA_TEST_ID.X_LABEL).length).toBeLessThan(MONTHS.length);
    await expect(canvas.getByText("Dec")).toBeVisible();
  },
};
