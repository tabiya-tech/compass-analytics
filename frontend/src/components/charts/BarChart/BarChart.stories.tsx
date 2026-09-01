import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, waitFor, within } from "storybook/test";
import { BarChart } from "./BarChart";

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
  play: async ({ canvasElement, canvas }) => {
    // One bar per category, and no legend — a single series is named by the title.
    await waitFor(
      async () => await expect(canvasElement.querySelectorAll(".recharts-rectangle")).toHaveLength(MONTHS.length)
    );

    await expect(canvasElement.querySelector(".recharts-legend-wrapper")).not.toBeInTheDocument();
    await expect(canvas.getByRole("table", { name: /Series A/ })).toBeInTheDocument();
  },
};

export const Stacked: Story = {
  args: {
    label: "Series A and Series B by month",
    series: [SERIES_A, SERIES_B],
    stacked: true,
  },
  play: async ({ canvasElement, canvas }) => {
    // Both segments of every column.
    await waitFor(
      async () => await expect(canvasElement.querySelectorAll(".recharts-rectangle")).toHaveLength(MONTHS.length * 2)
    );

    const legend = within(canvasElement.querySelector(".recharts-legend-wrapper")!);
    await expect(legend.getByText("Series A")).toBeVisible();
    await expect(legend.getByText("Series B")).toBeVisible();

    // A stack is read against its total, so the data table carries one.
    const table = within(canvas.getByRole("table", { name: /Series A and Series B/ }));
    await expect(table.getByRole("columnheader", { name: "Total" })).toBeInTheDocument();
  },
};

export const Grouped: Story = {
  args: {
    label: "Series A and Series B by month",
    series: [SERIES_A, SERIES_B],
    stacked: false,
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      async () => await expect(canvasElement.querySelectorAll(".recharts-rectangle")).toHaveLength(MONTHS.length * 2)
    );
  },
};

export const HoverShowsTooltip: Story = {
  args: { series: [SERIES_A, SERIES_B], stacked: true },
  play: async ({ canvasElement }) => {
    const bars = await waitFor(() => {
      const found = canvasElement.querySelectorAll<SVGPathElement>(".recharts-rectangle");
      if (found.length === 0) throw new Error("bars not rendered yet");
      return found;
    });

    const rect = bars[2].getBoundingClientRect();
    const point = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    fireEvent.mouseOver(bars[2], point);
    fireEvent.mouseMove(bars[2], point);

    // The readout names the category and lists every series in the stack, so
    // the pointer never has to land on one segment to read it.
    const tooltip = await waitFor(() => {
      const node = canvasElement.querySelector(".recharts-tooltip-wrapper [data-slot='chart-tooltip-content']");
      if (!node) throw new Error("tooltip not shown yet");
      return node as HTMLElement;
    });
    await expect(within(tooltip).getByText("Mar")).toBeInTheDocument();
    await expect(tooltip).toHaveTextContent(/series a/i);
    await expect(tooltip).toHaveTextContent(/series b/i);
  },
};
