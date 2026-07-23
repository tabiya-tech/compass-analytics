import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { SocialAuth } from "./SocialAuth";

const meta = {
  component: SocialAuth,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { onGoogle: fn() },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SocialAuth>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: { disabled: true },
};
