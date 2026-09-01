import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, waitFor, within } from "storybook/test";
import { LineChart } from "./LineChart";

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
  play: async ({ canvasElement, canvas }) => {
    // A single series gets no legend — the chart's own title already names it.
    await waitFor(
      async () => await expect(canvasElement.querySelectorAll(".recharts-layer.recharts-area")).toHaveLength(1)
    );

    await expect(canvasElement.querySelector(".recharts-legend-wrapper")).not.toBeInTheDocument();
    await expect(canvas.getByRole("table", { name: "Series A by month" })).toBeInTheDocument();
  },
};

export const FilledArea: Story = {
  args: { filled: true },
  play: async ({ canvasElement }) => {
    await waitFor(
      async () =>
        await expect(canvasElement.querySelector(".recharts-area-area")).toHaveAttribute("fill-opacity", "0.1")
    );
  },
};

export const MultipleSeries: Story = {
  args: {
    label: "Series A and Series B by month",
    series: [SERIES_A, SERIES_B],
    filled: true,
  },
  play: async ({ canvasElement, canvas }) => {
    // Two series, so the legend is mandatory: identity is never color alone.
    await waitFor(
      async () => await expect(canvasElement.querySelectorAll(".recharts-layer.recharts-area")).toHaveLength(2)
    );

    const legend = within(canvasElement.querySelector(".recharts-legend-wrapper")!);
    await expect(legend.getByText("Series A")).toBeVisible();
    await expect(legend.getByText("Series B")).toBeVisible();

    const table = within(canvas.getByRole("table", { name: "Series A and Series B by month" }));
    await expect(table.getByRole("columnheader", { name: "Series A" })).toBeInTheDocument();
    await expect(table.getByRole("columnheader", { name: "Series B" })).toBeInTheDocument();
  },
};

export const HoverShowsTooltip: Story = {
  args: { series: [SERIES_A, SERIES_B] },
  play: async ({ canvasElement }) => {
    const areas = await waitFor(() => {
      const found = canvasElement.querySelectorAll<SVGPathElement>(".recharts-area-area");
      if (found.length === 0) throw new Error("areas not rendered yet");
      return found;
    });

    const rect = areas[0].getBoundingClientRect();
    const point = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    fireEvent.mouseOver(areas[0], point);
    fireEvent.mouseMove(areas[0], point);

    // The readout names the hovered category and lists every series, so the
    // pointer never has to land on a particular line.
    const tooltip = await waitFor(() => {
      const node = canvasElement.querySelector(".recharts-tooltip-wrapper [data-slot='chart-tooltip-content']");
      if (!node) throw new Error("tooltip not shown yet");
      return node as HTMLElement;
    });
    await expect(tooltip).toHaveTextContent(/series a/i);
    await expect(tooltip).toHaveTextContent(/series b/i);
  },
};
