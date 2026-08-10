import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, waitFor, within } from "storybook/test";
import { Histogram } from "./Histogram";

const DEFAULT_BINS = [
  { from: 0, to: 5, count: 42 },
  { from: 5, to: 10, count: 168 },
  { from: 10, to: 15, count: 214 },
  { from: 15, to: 20, count: 131 },
  { from: 20, to: 25, count: 64 },
  { from: 25, to: 30, count: 27 },
];

const meta = {
  component: Histogram,
  tags: ["autodocs"],
  args: {
    label: "Distribution of values",
    bins: DEFAULT_BINS,
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
  play: async ({ canvasElement, canvas }) => {
    await waitFor(
      async () => await expect(canvasElement.querySelectorAll(".recharts-rectangle")).toHaveLength(DEFAULT_BINS.length)
    );

    await expect(canvas.getByRole("table", { name: "Distribution of values" })).toBeInTheDocument();
    await expect(canvasElement.querySelector(".recharts-reference-line-line")).not.toBeInTheDocument();
  },
};

export const WithTargetMarker: Story = {
  name: "With a target marker",
  args: {
    target: 15,
    targetLabel: "Target: 15",
  },
  play: async ({ canvasElement, canvas }) => {
    // Dashed on purpose: here the dashing means "threshold", which is exactly
    // what the line is. Gridlines stay solid.
    const line = await waitFor(() => {
      const found = canvasElement.querySelector(".recharts-reference-line-line");
      if (!found) throw new Error("target line not rendered yet");
      return found;
    });
    await expect(line).toHaveAttribute("stroke-dasharray", "4 3");
    await expect(canvas.getByText("Target: 15")).toBeInTheDocument();
  },
};

export const HoverShowsTooltip: Story = {
  play: async ({ canvasElement }) => {
    const bars = await waitFor(() => {
      const found = canvasElement.querySelectorAll<SVGPathElement>(".recharts-rectangle");
      if (found.length === 0) throw new Error("bars not rendered yet");
      return found;
    });

    const target = bars[2];
    const rect = target.getBoundingClientRect();
    const point = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    fireEvent.mouseOver(target, point);
    fireEvent.mouseMove(target, point);

    // The readout names of the hovered bin's range and its count.
    const tooltip = await waitFor(() => {
      const node = canvasElement.querySelector(".recharts-tooltip-wrapper [data-slot='chart-tooltip-content']");
      if (!node) throw new Error("tooltip not shown yet");
      return node as HTMLElement;
    });
    await expect(within(tooltip).getByText("10 to 15")).toBeInTheDocument();
    await expect(within(tooltip).getByText("214")).toBeInTheDocument();
  },
};
