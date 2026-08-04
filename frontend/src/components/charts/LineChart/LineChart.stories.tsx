import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { LineChart, DATA_TEST_ID } from "./LineChart";
import { DATA_TEST_ID as FRAME_TEST_ID } from "@/components/charts/components/ChartFrame";
import { DATA_TEST_ID as LEGEND_TEST_ID } from "@/components/charts/components/ChartLegend";

// Placeholder data throughout — the real copy is not settled, and a story that
// shows product strings gets mistaken for a spec.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SERIES_A = {
  id: "a",
  label: "Series A",
  points: [180, 210, 240, 260, 330, 300, 380, 410, 520, 560, 610, 590].map((value, index) => ({
    label: MONTHS[index],
    value,
  })),
};

const SERIES_B = {
  id: "b",
  label: "Series B",
  points: [90, 120, 140, 130, 190, 170, 230, 250, 310, 340, 380, 360].map((value, index) => ({
    label: MONTHS[index],
    value,
  })),
};

const meta = {
  component: LineChart,
  tags: ["autodocs"],
  args: {
    label: "Series A by month",
    series: [SERIES_A],
  },
  decorators: [
    (Story) => (
      <div className="w-160 max-w-full rounded-card bg-card p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleSeries: Story = {
  play: async ({ canvas }) => {
    // A single series gets no legend — the chart's own title already names it.
    await waitFor(async () => await expect(canvas.getAllByTestId(DATA_TEST_ID.LINE)).toHaveLength(1));

    await expect(canvas.getByRole("img", { name: "Series A by month" })).toBeInTheDocument();
    await expect(canvas.queryByTestId(LEGEND_TEST_ID.CONTAINER)).not.toBeInTheDocument();
    await expect(canvas.queryByTestId(DATA_TEST_ID.AREA)).not.toBeInTheDocument();
  },
};

export const FilledArea: Story = {
  args: { filled: true },
  play: async ({ canvas }) => {
    await waitFor(async () => await expect(canvas.getAllByTestId(DATA_TEST_ID.AREA)).toHaveLength(1));
  },
};

export const MultipleSeries: Story = {
  args: {
    label: "Series A and Series B by month",
    series: [SERIES_A, SERIES_B],
    filled: true,
  },
  play: async ({ canvas }) => {
    // Two series, so the legend is mandatory: identity is never color alone.
    await waitFor(async () => await expect(canvas.getAllByTestId(DATA_TEST_ID.LINE)).toHaveLength(2));

    const legend = within(canvas.getByTestId(LEGEND_TEST_ID.CONTAINER));
    await expect(legend.getByText("Series A")).toBeVisible();
    await expect(legend.getByText("Series B")).toBeVisible();
  },
};

export const HoverShowsCrosshairAndTooltip: Story = {
  args: { series: [SERIES_A, SERIES_B] },
  play: async ({ canvas }) => {
    const plot = await waitFor(() => canvas.getByTestId(FRAME_TEST_ID.PLOT));

    await userEvent.hover(plot);

    // The crosshair snaps to a data position, and every series is marked there,
    // so the pointer never has to land on a particular line.
    await waitFor(async () => await expect(canvas.getByTestId(DATA_TEST_ID.CROSSHAIR)).toBeInTheDocument());
    await expect(canvas.getAllByTestId(DATA_TEST_ID.MARKER)).toHaveLength(2);
  },
};

export const Empty: Story = {
  args: { series: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId(FRAME_TEST_ID.EMPTY)).toBeVisible();
    await expect(canvas.queryByTestId(FRAME_TEST_ID.PLOT)).not.toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: { isLoading: true },
  play: async ({ canvas }) => {
    // The previous render is held at reduced opacity rather than replaced by a
    // skeleton, so the card never jumps while data refetches.
    await waitFor(
      async () => await expect(canvas.getByTestId(FRAME_TEST_ID.CONTAINER)).toHaveAttribute("aria-busy", "true")
    );

    await expect(canvas.getByTestId(FRAME_TEST_ID.PLOT)).toBeInTheDocument();
  },
};

// The plot sizes itself to whatever card it is dropped into, and the x labels
// thin out rather than overlapping.
export const Narrow: Story = {
  name: "Responsive (narrow container)",
  decorators: [
    (Story) => (
      <div className="w-70 rounded-card bg-card p-4">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    const plot = await waitFor(() => canvas.getByTestId(FRAME_TEST_ID.PLOT));

    await expect(Number(plot.getAttribute("width"))).toBeLessThan(280);
  },
};
