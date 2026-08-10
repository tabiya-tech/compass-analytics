import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { DonutChart, DATA_TEST_ID, type DonutChartProps } from "./DonutChart";
import { DATA_TEST_ID as LEGEND_TEST_ID } from "@/components/charts/DonutChart/components/ChartLegend";

// Placeholder data throughout — the real copy is not settled.
const TWO_GROUPS = [
  { id: "a", label: "Group A", value: 60 },
  { id: "b", label: "Group B", value: 40 },
];

const THREE_GROUPS = [
  { id: "a", label: "Group A", value: 52 },
  { id: "b", label: "Group B", value: 41 },
  { id: "c", label: "Group C", value: 7 },
];

// The donut is controlled, so the story owns the selection to keep the legend interactive.
function ControlledDonutChart({ selectedId, onSelect, ...props }: Readonly<DonutChartProps>) {
  const [value, setValue] = useState<string | null>(selectedId ?? null);

  return (
    <DonutChart
      {...props}
      selectedId={value}
      onSelect={(next) => {
        setValue(next);
        onSelect?.(next);
      }}
    />
  );
}

const meta = {
  component: DonutChart,
  tags: ["autodocs"],
  args: {
    label: "Share by group",
    slices: TWO_GROUPS,
  },
  decorators: [
    (Story) => (
      <div className="w-110 max-w-full rounded-card bg-card p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DonutChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, canvas }) => {
    await expect(canvasElement.querySelectorAll(".recharts-sector")).toHaveLength(2);
    await expect(canvas.getByRole("img", { name: "Share by group" })).toBeInTheDocument();

    const legend = within(canvas.getByTestId(LEGEND_TEST_ID.CONTAINER));
    await expect(legend.getByText("60%")).toBeVisible();
    await expect(legend.getByText("40%")).toBeVisible();
  },
};

export const WithCenterLabel: Story = {
  args: {
    centerLabel: "2.2",
    centerCaption: "per group",
  },
  play: async ({ canvas }) => {
    const center = canvas.getByTestId(DATA_TEST_ID.CENTER_LABEL);

    await expect(center).toHaveTextContent("2.2");
    await expect(center).toHaveAttribute("aria-hidden", "true");
  },
};

export const ThreeSlices: Story = {
  args: { slices: THREE_GROUPS },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll(".recharts-sector")).toHaveLength(3);
  },
};

export const WithSelection: Story = {
  args: { slices: THREE_GROUPS, selectedId: "a" },
  render: (args) => <ControlledDonutChart {...args} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /Group A/ })).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByRole("button", { name: /Group B/ })).toHaveAttribute("aria-pressed", "false");
  },
};

export const SelectingASlice: Story = {
  args: { slices: THREE_GROUPS },
  render: (args) => <ControlledDonutChart {...args} />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: /Group B/ }));

    await expect(canvas.getByRole("button", { name: /Group B/ })).toHaveAttribute("aria-pressed", "true");
  },
};

export const SingleSlice: Story = {
  args: {
    slices: [{ id: "a", label: "Group A", value: 100 }],
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll(".recharts-sector")).toHaveLength(1);
  },
};
