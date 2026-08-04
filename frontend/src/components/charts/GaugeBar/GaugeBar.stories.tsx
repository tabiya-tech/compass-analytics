import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { GaugeBar, DATA_TEST_ID } from "./GaugeBar";
import { ChartLegend } from "@/components/charts/components/ChartLegend";

// Placeholder data throughout — the real copy is not settled.
const ITEMS = [
  { label: "Item A", value: 561, secondaryValue: 1016 },
  { label: "Item B", value: 926, secondaryValue: 1415 },
  { label: "Item C", value: 724, secondaryValue: 1073 },
  { label: "Item D", value: 592, secondaryValue: 1000 },
];

const SCALE = 2000;

const LEGEND = [
  { id: "done", label: "Completed", color: "var(--chart-progress-done)" },
  { id: "active", label: "In progress", color: "var(--chart-progress-active)" },
  { id: "not-started", label: "Not started", color: "var(--chart-track)" },
];

const meta = {
  component: GaugeBar,
  tags: ["autodocs"],
  args: {
    label: "Item A",
    value: 561,
    secondaryValue: 1016,
    max: SCALE,
    valueLabel: "completed",
    secondaryValueLabel: "started",
  },
  decorators: [
    (Story) => (
      <div className="w-160 max-w-full rounded-card bg-card p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GaugeBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    // Both figures are written out, so the decorative track adds nothing a
    // screen reader has to parse.
    await expect(canvas.getByTestId(DATA_TEST_ID.CAPTION)).toHaveTextContent("561 completed · 1,016 started");
    await expect(canvas.getByTestId(DATA_TEST_ID.TRACK)).toHaveAttribute("aria-hidden", "true");
  },
};

// A group of rows on one shared scale, with the legend below rather than
// repeated per bar — how the completions card is composed.
export const SeveralRows: Story = {
  name: "Several rows on a shared scale",
  render: () => (
    <div className="grid gap-5">
      {ITEMS.map((item) => (
        <GaugeBar
          key={item.label}
          label={item.label}
          value={item.value}
          secondaryValue={item.secondaryValue}
          max={SCALE}
          valueLabel="completed"
          secondaryValueLabel="started"
        />
      ))}
      <ChartLegend items={LEGEND} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByTestId(DATA_TEST_ID.CONTAINER)).toHaveLength(ITEMS.length);
    await expect(canvas.getByText("Not started")).toBeVisible();
  },
};

// Without a shared maximum each row scales to its own outer figure, so the
// bars stop being comparable — useful for a single standalone measure only.
export const WithoutASharedScale: Story = {
  args: { max: undefined },
  play: async ({ canvas }) => {
    await expect(Number.parseFloat(canvas.getByTestId(DATA_TEST_ID.ACTIVE).style.width)).toBe(100);
  },
};

export const SingleSegment: Story = {
  args: { secondaryValue: undefined, value: 750, max: 1000, valueLabel: "completed" },
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId(DATA_TEST_ID.CAPTION)).toHaveTextContent("750 completed");
  },
};

export const NothingStartedYet: Story = {
  args: { value: 0, secondaryValue: 0 },
  play: async ({ canvas }) => {
    await expect(Number.parseFloat(canvas.getByTestId(DATA_TEST_ID.DONE).style.width)).toBe(0);
  },
};

export const StartedButNoneComplete: Story = {
  args: { value: 0, secondaryValue: 120 },
  play: async ({ canvas }) => {
    const track = within(canvas.getByTestId(DATA_TEST_ID.TRACK));

    await expect(track.getByTestId(DATA_TEST_ID.ACTIVE)).toBeInTheDocument();
    await expect(Number.parseFloat(canvas.getByTestId(DATA_TEST_ID.DONE).style.width)).toBe(0);
  },
};
