import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";
import { Checkbox } from "./checkbox";

const meta = {
  component: Checkbox,
  tags: ["ai-generated"],
  args: {
    "aria-label": "Example option",
    onCheckedChange: fn(),
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("checkbox")).not.toBeChecked();
  },
};

export const Checked: Story = {
  args: { checked: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("checkbox")).toBeChecked();
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("checkbox")).toBeDisabled();
  },
};

export const Toggle: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("checkbox"));
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true);
  },
};
