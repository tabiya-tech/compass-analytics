import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { BarChart, DATA_TEST_ID } from "./BarChart";
import { DATA_TEST_ID as FRAME_TEST_ID } from "@/components/charts/components/ChartFrame";
import { DATA_TEST_ID as LEGEND_TEST_ID } from "@/components/charts/components/ChartLegend";
import { DATA_TEST_ID as TOOLTIP_TEST_ID } from "@/components/charts/components/ChartTooltip";

// Placeholder data throughout — the real copy is not settled.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];

const SERIES_A = { id: "a", label: "Series A", values: [155, 96, 160, 152, 258, 118, 205, 128] };
const SERIES_B = { id: "b", label: "Series B", values: [63, 41, 66, 58, 105, 51, 108, 52] };

const meta = {
  component: BarChart,
  tags: ["autodocs"],
  args: {
    label: "Series A by month",
    categories: MONTHS,
    series: [SERIES_A],
  },
  decorators: [
    (Story) => (
      <div className="w-160 max-w-full rounded-card bg-card p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleSeries: Story = {
  play: async ({ canvas }) => {
    // One bar per category, and no legend — a single series is named by the title.
    await waitFor(async () => await expect(canvas.getAllByTestId(DATA_TEST_ID.BAR)).toHaveLength(MONTHS.length));

    await expect(canvas.queryByTestId(LEGEND_TEST_ID.CONTAINER)).not.toBeInTheDocument();
  },
};

export const Stacked: Story = {
  args: {
    label: "Series A and Series B by month",
    series: [SERIES_A, SERIES_B],
    stacked: true,
  },
  play: async ({ canvas }) => {
    // Both segments of every column, separated by the 2px surface gap.
    await waitFor(async () => await expect(canvas.getAllByTestId(DATA_TEST_ID.BAR)).toHaveLength(MONTHS.length * 2));

    const legend = within(canvas.getByTestId(LEGEND_TEST_ID.CONTAINER));
    await expect(legend.getByText("Series A")).toBeVisible();
    await expect(legend.getByText("Series B")).toBeVisible();

    // A stack is read against its total, so the data table carries one.
    const table = within(canvas.getByTestId(FRAME_TEST_ID.TABLE));
    await expect(table.getByRole("columnheader", { name: "Total" })).toBeInTheDocument();
  },
};

export const Grouped: Story = {
  args: {
    label: "Series A and Series B by month",
    series: [SERIES_A, SERIES_B],
    stacked: false,
  },
  play: async ({ canvas }) => {
    await waitFor(async () => await expect(canvas.getAllByTestId(DATA_TEST_ID.BAR)).toHaveLength(MONTHS.length * 2));
  },
};

export const HoverShowsTooltip: Story = {
  args: { series: [SERIES_A, SERIES_B], stacked: true },
  play: async ({ canvas }) => {
    const bands = await waitFor(() => canvas.getAllByTestId(DATA_TEST_ID.BAND));

    await userEvent.hover(bands[2]);

    // The readout names the category and lists every series in the stack, so
    // the pointer never has to land on one segment to read it.
    const tooltip = await waitFor(() => canvas.getByTestId(TOOLTIP_TEST_ID.CONTAINER));
    await expect(within(tooltip).getByText("Mar")).toBeInTheDocument();
    await expect(within(tooltip).getAllByTestId(TOOLTIP_TEST_ID.ROW)).toHaveLength(2);
  },
};

export const Empty: Story = {
  args: { categories: [], series: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId(FRAME_TEST_ID.EMPTY)).toBeVisible();
  },
};
