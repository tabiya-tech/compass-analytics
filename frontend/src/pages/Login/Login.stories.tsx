import type { Meta, StoryObj } from "@storybook/react-vite";
import { Login } from "./Login";

const meta = {
  component: Login,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Login>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
