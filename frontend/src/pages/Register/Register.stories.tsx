import type { Meta, StoryObj } from "@storybook/react-vite";
import { Register } from "./Register";

const meta = {
  component: Register,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Register>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
