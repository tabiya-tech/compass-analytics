import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { UserAvatar, DATA_TEST_ID } from "./UserAvatar";

const meta = {
  component: UserAvatar,
  tags: ["autodocs"],
  args: {
    name: "Amara Moyo",
  },
} satisfies Meta<typeof UserAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IconFallback: Story = {
  play: async ({ canvas }) => {
    // GIVEN a jobseeker with no photo
    // WHEN rendered
    // THEN a generic person icon stands in for the photo
    await expect(canvas.getByTestId(DATA_TEST_ID.FALLBACK).querySelector("svg")).toBeInTheDocument();
  },
};

export const WithPhoto: Story = {
  args: { src: "https://github.com/shadcn.png" },
  play: async ({ canvas }) => {
    // GIVEN a jobseeker with a photo
    // WHEN rendered
    // THEN the circle renders — the photo replaces the icon only once it has loaded
    await expect(canvas.getByTestId(DATA_TEST_ID.CONTAINER)).toBeInTheDocument();
  },
};

export const Small: Story = {
  args: { size: "sm", name: "Blessing González" },
  play: async ({ canvas }) => {
    // GIVEN a table-row-sized avatar
    // WHEN rendered
    // THEN it renders at the small size
    await expect(canvas.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveAttribute("data-size", "sm");
  },
};

export const Large: Story = {
  args: { size: "lg", name: "Ndola Livelihoods Trust" },
  play: async ({ canvas }) => {
    // GIVEN a profile-card-sized avatar
    // WHEN rendered
    // THEN it renders at the large size
    await expect(canvas.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveAttribute("data-size", "lg");
  },
};
