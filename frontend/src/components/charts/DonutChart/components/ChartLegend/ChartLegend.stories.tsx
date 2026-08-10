import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { ChartLegend, DATA_TEST_ID, type ChartLegendProps } from "./ChartLegend";
import { seriesColorAt } from "@/components/charts/chart-palette";

// Placeholder data throughout — the real copy is not settled.
const SERIES = [
  { id: "a", label: "Series A", color: seriesColorAt(0) },
  { id: "b", label: "Series B", color: seriesColorAt(1) },
];

const SLICES = [
  { id: "a", label: "Group A", color: seriesColorAt(0), value: "52%" },
  { id: "b", label: "Group B", color: seriesColorAt(1), value: "41%" },
  { id: "c", label: "Group C", color: seriesColorAt(2), value: "7%" },
];

// The legend is controlled, so the story owns the selection to keep it interactive.
function ControlledChartLegend({ selectedId, onSelect, ...props }: Readonly<ChartLegendProps>) {
  const [value, setValue] = useState<string | null>(selectedId ?? null);

  return (
    <ChartLegend
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
  component: ChartLegend,
  tags: ["autodocs"],
  args: {
    items: SERIES,
  },
  decorators: [
    (Story) => (
      <div className="w-110 max-w-full rounded-card bg-card p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChartLegend>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByTestId(DATA_TEST_ID.ITEM)).toHaveLength(SERIES.length);
    await expect(canvas.queryAllByRole("button")).toHaveLength(0);
  },
};

// A rule rather than a swatch, mirroring the mark it names on a line chart.
export const LineKeys: Story = {
  args: { markShape: "line" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Series A")).toBeVisible();
  },
};

export const VerticalWithValues: Story = {
  args: { items: SLICES, orientation: "vertical" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("52%")).toBeVisible();
    await expect(canvas.getByText("Group C")).toBeVisible();
  },
};

export const WithSelection: Story = {
  args: { items: SLICES, orientation: "vertical", selectedId: "a" },
  render: (args) => <ControlledChartLegend {...args} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /Group A/ })).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByRole("button", { name: /Group B/ })).toHaveAttribute("aria-pressed", "false");
  },
};
