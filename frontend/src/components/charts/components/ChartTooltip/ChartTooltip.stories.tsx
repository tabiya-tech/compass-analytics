import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ChartTooltip, DATA_TEST_ID } from "./ChartTooltip";
import { seriesColorAt } from "@/components/charts/chart-palette";

const CONTAINER_WIDTH = 440;

// Placeholder data throughout — the real copy is not settled.
const ROWS = [
  { label: "Series A", value: "258", color: seriesColorAt(0) },
  { label: "Series B", value: "105", color: seriesColorAt(1) },
];

const meta = {
  component: ChartTooltip,
  tags: ["autodocs"],
  args: {
    title: "Mar",
    rows: ROWS,
    x: 120,
    y: 80,
    containerWidth: CONTAINER_WIDTH,
  },
  decorators: [
    (Story) => (
      <div className="relative h-40 w-110 max-w-full rounded-card bg-card">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChartTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EverySeriesAtOnePosition: Story = {
  play: async ({ canvas }) => {
    const tooltip = within(canvas.getByTestId(DATA_TEST_ID.CONTAINER));

    await expect(tooltip.getByText("Mar")).toBeVisible();
    await expect(tooltip.getAllByTestId(DATA_TEST_ID.ROW)).toHaveLength(2);
    await expect(tooltip.getByText("258")).toBeVisible();
  },
};

export const SingleSeries: Story = {
  args: { rows: [ROWS[0]] },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByTestId(DATA_TEST_ID.ROW)).toHaveLength(1);
  },
};

export const FlippedAtTheRightEdge: Story = {
  args: { x: CONTAINER_WIDTH - 20 },
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveClass("-translate-x-full");
  },
};

export const HiddenFromAssistiveTech: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveAttribute("aria-hidden", "true");
  },
};
