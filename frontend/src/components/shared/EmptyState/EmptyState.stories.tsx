import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";
import { Users } from "lucide-react";
import { EmptyState } from "./EmptyState";

const meta = {
  component: EmptyState,
  tags: ["autodocs"],
  args: {
    message: "No jobseekers match these filters.",
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MessageOnly: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No jobseekers match these filters.")).toBeVisible();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

export const WithAction: Story = {
  args: {
    action: { label: "Clear filters", onClick: fn() },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Clear filters" })).toBeVisible();
  },
};

export const WithCustomIcon: Story = {
  args: {
    message: "No institutions in this grant yet.",
    icon: <Users />,
    action: { label: "Clear filters", onClick: fn() },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No institutions in this grant yet.")).toBeVisible();
  },
};
