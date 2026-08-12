import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { AccessErrorPage, DATA_TEST_ID } from "./AccessErrorPage";

const meta = {
  title: "Access/AccessErrorPage",
  component: AccessErrorPage,
  tags: ["autodocs"],
} satisfies Meta<typeof AccessErrorPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Error: Story = {
  args: { variant: "error" },
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId(DATA_TEST_ID.message)).toBeVisible();
    await expect(canvas.getByRole("button", { name: /retry/i })).toBeVisible();
  },
};

export const Unprovisioned: Story = {
  args: { variant: "unprovisioned" },
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId(DATA_TEST_ID.message)).toBeVisible();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};
