import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Sparkline, DATA_TEST_ID } from "./Sparkline";

// Placeholder data throughout — the real copy is not settled.
const RISING = [180, 210, 240, 260, 330, 300, 380, 410, 520, 560, 610, 590];
const FALLING = [610, 560, 520, 410, 380, 300, 330, 260, 240, 210, 180, 170];

const meta = {
  component: Sparkline,
  tags: ["autodocs"],
  args: {
    values: RISING,
  },
} satisfies Meta<typeof Sparkline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rising: Story = {
  play: async ({ canvas }) => {
    // With no label given, the shape is described from its first and last values.
    await expect(canvas.getByRole("img", { name: "Trend rising, from 180 to 590" })).toBeVisible();
    await expect(canvas.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveAttribute("data-direction", "up");
  },
};

export const Falling: Story = {
  args: { values: FALLING },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "Trend falling, from 610 to 170" })).toBeVisible();
    await expect(canvas.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveAttribute("data-direction", "down");
  },
};

export const FilledWithEndMarker: Story = {
  args: { filled: true, showEndMarker: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId(DATA_TEST_ID.AREA)).toBeInTheDocument();
    await expect(canvas.getByTestId(DATA_TEST_ID.END_MARKER)).toBeInTheDocument();
  },
};

export const WithExplicitLabel: Story = {
  args: { label: "Series A over the last twelve points" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "Series A over the last twelve points" })).toBeVisible();
  },
};

// A single point has no shape to draw, so nothing renders at all.
export const TooFewPoints: Story = {
  args: { values: [42] },
  play: async ({ canvas }) => {
    await expect(canvas.queryByTestId(DATA_TEST_ID.CONTAINER)).not.toBeInTheDocument();
  },
};

// Beside a figure, which is the usual home: the number is the value, the
// sparkline only carries the shape.
export const BesideAValue: Story = {
  name: "Beside a value",
  args: { showEndMarker: true },
  render: (args) => (
    <div className="w-72 rounded-card bg-card p-5">
      <p className="font-mono text-xs tracking-[2px] text-foreground/70 uppercase">Series A</p>
      <div className="mt-2 flex items-center justify-between gap-4">
        <p className="text-4xl font-bold tracking-tight text-foreground">1,284</p>
        <Sparkline {...args} />
      </div>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText("1,284")).toBeVisible();
    await expect(canvas.getByRole("img", { name: /Trend rising/ })).toBeVisible();
  },
};
