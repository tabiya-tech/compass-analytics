import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { Histogram, DATA_TEST_ID } from "./Histogram";
import { DATA_TEST_ID as FRAME_TEST_ID } from "@/components/charts/components/ChartFrame";

// Placeholder data throughout — the real copy is not settled. Five-unit bins.
const COMPLETION_TIME_BINS = [
  { from: 0, to: 5, count: 42 },
  { from: 5, to: 10, count: 168 },
  { from: 10, to: 15, count: 214 },
  { from: 15, to: 20, count: 131 },
  { from: 20, to: 25, count: 64 },
  { from: 25, to: 30, count: 27 },
];

const UNEVEN_BINS = [
  { from: 0, to: 5, count: 42 },
  { from: 5, to: 10, count: 168 },
  { from: 10, to: 20, count: 345 },
  { from: 20, to: 40, count: 91 },
];

const units = (value: number) => `${value}`;

const meta = {
  component: Histogram,
  tags: ["autodocs"],
  args: {
    label: "Distribution of values",
    bins: COMPLETION_TIME_BINS,
    boundFormatter: units,
    countLabel: "Jobseekers",
  },
  decorators: [
    (Story) => (
      <div className="w-150 max-w-full rounded-card bg-card p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Histogram>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await waitFor(
      async () => await expect(canvas.getAllByTestId(DATA_TEST_ID.BIN)).toHaveLength(COMPLETION_TIME_BINS.length)
    );

    await expect(canvas.getByRole("img", { name: "Distribution of values" })).toBeInTheDocument();
    await expect(canvas.queryByTestId(DATA_TEST_ID.TARGET)).not.toBeInTheDocument();
  },
};

export const WithTargetMarker: Story = {
  name: "With a target marker",
  args: {
    target: 15,
    targetLabel: "Target 15",
  },
  play: async ({ canvas }) => {
    // Dashed on purpose: here the dashing means "threshold", which is exactly
    // what the line is. Gridlines stay solid.
    await waitFor(async () => await expect(canvas.getByTestId(DATA_TEST_ID.TARGET)).toBeInTheDocument());

    await expect(canvas.getByTestId(DATA_TEST_ID.TARGET)).toHaveAttribute("stroke-dasharray", "4 3");
    await expect(canvas.getByTestId(DATA_TEST_ID.TARGET_LABEL)).toHaveTextContent("Target 15");

    // Every bin stays reachable without hovering.
    const table = within(canvas.getByTestId(FRAME_TEST_ID.TABLE));
    await expect(table.getByRole("rowheader", { name: "10 to 15" })).toBeInTheDocument();
  },
};

// Bins sit on a continuous scale, so a bin twice as wide is drawn twice as
// wide rather than flattened into an equal slot.
export const UnevenBins: Story = {
  args: {
    bins: UNEVEN_BINS,
    target: 15,
    targetLabel: "Target 15",
  },
  play: async ({ canvas }) => {
    const bars = await waitFor(() => canvas.getAllByTestId(DATA_TEST_ID.BIN));
    const widthOf = (index: number) => Number(bars[index].getAttribute("data-bin-width"));

    await expect(widthOf(3)).toBeGreaterThan(widthOf(2));
    await expect(widthOf(2)).toBeGreaterThan(widthOf(1));
  },
};

export const Empty: Story = {
  args: { bins: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId(FRAME_TEST_ID.EMPTY)).toBeVisible();
  },
};

export const Loading: Story = {
  args: { isLoading: true },
  play: async ({ canvas }) => {
    await waitFor(
      async () => await expect(canvas.getByTestId(FRAME_TEST_ID.CONTAINER)).toHaveAttribute("aria-busy", "true")
    );
  },
};
