import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { HBar, DATA_TEST_ID, type HBarProps } from "./HBar";

// Placeholder data throughout — the real copy is not settled.
const CATEGORIES = [
  { id: "a", label: "Category A", value: 188 },
  { id: "b", label: "Category B", value: 152 },
  { id: "c", label: "Category C", value: 137 },
  { id: "d", label: "Category D", value: 130 },
  { id: "e", label: "Category E", value: 116 },
];

// The list is controlled, so the story owns the selection to keep the rows interactive.
function ControlledHBar({ selectedId, onSelect, ...props }: Readonly<HBarProps>) {
  const [value, setValue] = useState<string | null>(selectedId ?? null);

  return (
    <HBar
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
  component: HBar,
  tags: ["autodocs"],
  args: {
    label: "Values by category",
    items: CATEGORIES,
  },
  decorators: [
    (Story) => (
      <div className="w-110 max-w-full rounded-card bg-card p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByTestId(DATA_TEST_ID.ROW)).toHaveLength(CATEGORIES.length);
    await expect(canvas.getByText("Category A")).toBeVisible();
    await expect(canvas.getByText("188")).toBeVisible();

    await expect(canvas.queryAllByRole("button")).toHaveLength(0);
  },
};

export const WithSelection: Story = {
  args: { selectedId: "b" },
  render: (args) => <ControlledHBar {...args} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /Category B/ })).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByRole("button", { name: /Category A/ })).toHaveAttribute("aria-pressed", "false");
  },
};

export const SelectingAnItem: Story = {
  render: (args) => <ControlledHBar {...args} />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: /Category C/ }));

    await expect(canvas.getByRole("button", { name: /Category C/ })).toHaveAttribute("aria-pressed", "true");
  },
};
