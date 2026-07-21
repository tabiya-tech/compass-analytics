import type { Meta, StoryObj } from "@storybook/react-vite";
import { Separator } from "./separator";

const meta = {
  component: Separator,
  tags: ["ai-generated"],
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: (args) => (
    <div className="w-64">
      <div className="text-sm">Above</div>
      <Separator {...args} className="my-3" />
      <div className="text-sm">Below</div>
    </div>
  ),
};

export const Vertical: Story = {
  render: (args) => (
    <div className="flex h-12 items-center gap-3">
      <div className="text-sm">Left</div>
      <Separator {...args} orientation="vertical" />
      <div className="text-sm">Right</div>
    </div>
  ),
};
