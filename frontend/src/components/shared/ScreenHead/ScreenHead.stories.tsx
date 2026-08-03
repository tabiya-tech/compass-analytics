import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { ScreenHead } from "./ScreenHead";

const meta = {
  component: ScreenHead,
  tags: ["autodocs"],
  args: {
    title: "Overview",
  },
} satisfies Meta<typeof ScreenHead>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  },
};

export const WithEyebrow: Story = {
  args: { eyebrow: "Deployment overview" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Deployment overview")).toBeVisible();
  },
};

export const WithDescription: Story = {
  args: { description: "Ndola Livelihoods Trust · Jul '25 – Jul '26" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Ndola Livelihoods Trust · Jul '25 – Jul '26")).toBeVisible();
  },
};

export const WithEverything: Story = {
  args: {
    eyebrow: "Individual view",
    title: "Jobseekers",
    description: "Every jobseeker in scope, one per row. Sort any column by its header.",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Individual view")).toBeVisible();
    await expect(canvas.getByRole("heading", { level: 1, name: "Jobseekers" })).toBeVisible();
    await expect(canvas.getByText(/Every jobseeker in scope/)).toBeVisible();
  },
};
