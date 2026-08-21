import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { UserAccessSkeleton } from "./UserAccessSkeleton";

const meta = {
  component: UserAccessSkeleton,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UserAccessSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveAttribute("aria-busy", "true");
  },
};

export const ShortList: Story = {
  args: { rows: 3 },
};
