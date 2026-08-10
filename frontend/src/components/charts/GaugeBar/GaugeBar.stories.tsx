import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { GaugeBar, DATA_TEST_ID } from "./GaugeBar";

const meta = {
  component: GaugeBar,
  tags: ["autodocs"],
  args: {
    label: "Avg. time to complete",
    value: 12,
    max: 15,
    valueLabel: "minutes",
  },
  decorators: [
    (Story) => (
      <div className="w-110 max-w-full rounded-card bg-card p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GaugeBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every bar segment is a `<path class="recharts-rectangle">`; Recharts skips rendering one entirely for a zero value. */
function bars(canvasElement: HTMLElement) {
  return [...canvasElement.querySelectorAll<SVGPathElement>(".recharts-rectangle")];
}

export const OnTarget: Story = {
  args: { value: 15 },
  play: async ({ canvasElement, canvas }) => {
    await expect(canvas.getByTestId(DATA_TEST_ID.CAPTION)).toHaveTextContent("15 minutes");

    const actual = await waitFor(() => {
      const found = bars(canvasElement);
      if (found.length === 0) throw new Error("bars not rendered yet");
      return found;
    });
    await expect(actual[0]).toHaveAttribute("fill", "var(--chart-1)");
  },
};

// Short of its target: reads as off-track, in the shared warning colour.
export const OffTarget: Story = {
  args: { value: 8 },
  play: async ({ canvasElement, canvas }) => {
    await expect(canvas.getByTestId(DATA_TEST_ID.CAPTION)).toHaveTextContent("8 minutes");

    const actual = await waitFor(() => {
      const found = bars(canvasElement);
      if (found.length === 0) throw new Error("bars not rendered yet");
      return found;
    });
    await expect(actual[0]).toHaveAttribute("fill", "var(--chart-warning)");
  },
};

export const SingleValue: Story = {
  args: { label: "CV Builder", value: 750, max: undefined, valueLabel: "completed" },
  play: async ({ canvasElement, canvas }) => {
    await expect(canvas.getByTestId(DATA_TEST_ID.CAPTION)).toHaveTextContent("750 completed");

    await waitFor(async () => await expect(bars(canvasElement)).toHaveLength(1));
  },
};

export const TwoStageProgress: Story = {
  name: "Two-stage progress",
  args: {
    label: "CV Builder",
    value: 561,
    secondaryValue: 1016,
    max: 2000,
    valueLabel: "completed",
    secondaryValueLabel: "started",
  },
  play: async ({ canvasElement, canvas }) => {
    await expect(canvas.getByTestId(DATA_TEST_ID.CAPTION)).toHaveTextContent("561 completed · 1,016 started");

    const actual = await waitFor(() => {
      const found = bars(canvasElement);
      if (found.length !== 2) throw new Error("bars not rendered yet");
      return found;
    });
    await expect(actual[0]).toHaveAttribute("fill", "var(--chart-progress-done)");
    await expect(actual[1]).toHaveAttribute("fill", "var(--chart-progress-active)");
  },
};
