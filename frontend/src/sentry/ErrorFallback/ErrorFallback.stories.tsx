import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { ErrorFallback } from "./ErrorFallback";

const meta = {
  title: "Sentry/ErrorFallback",
  component: ErrorFallback,
  tags: ["autodocs"],
} satisfies Meta<typeof ErrorFallback>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Reload page" })).toBeVisible();
  },
};
