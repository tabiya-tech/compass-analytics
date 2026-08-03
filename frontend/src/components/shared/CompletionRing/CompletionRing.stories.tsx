import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { CompletionRing, DATA_TEST_ID } from "./CompletionRing";

const meta = {
  component: CompletionRing,
  tags: ["autodocs"],
  args: {
    value: 64,
  },
} satisfies Meta<typeof CompletionRing>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { value: 0, label: "0%" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("progressbar", { name: "0% complete" })).toHaveAttribute("aria-valuenow", "0");
    await expect(canvas.getByTestId(DATA_TEST_ID.PROGRESS)).toHaveClass("stroke-amber-400");
  },
};

export const NeedsAttention: Story = {
  args: { value: 40, label: "40%" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("progressbar", { name: "40% complete" })).toHaveAttribute("aria-valuenow", "40");
    await expect(canvas.getByTestId(DATA_TEST_ID.PROGRESS)).toHaveClass("stroke-amber-400");
  },
};

export const Partial: Story = {
  args: { value: 64, label: "64%" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("progressbar", { name: "64% complete" })).toHaveAttribute("aria-valuenow", "64");
    await expect(canvas.getByTestId(DATA_TEST_ID.PROGRESS)).toHaveClass("stroke-green-2");
  },
};

export const Complete: Story = {
  args: { value: 100, label: "100%" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("progressbar", { name: "100% complete" })).toHaveAttribute("aria-valuenow", "100");
    await expect(canvas.getByTestId(DATA_TEST_ID.PROGRESS)).toHaveClass("stroke-green-3");
  },
};

export const WithoutCenterLabel: Story = {
  args: { value: 90 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("progressbar", { name: "90% complete" })).toBeVisible();
    await expect(canvas.queryByText("90%")).not.toBeInTheDocument();
  },
};
