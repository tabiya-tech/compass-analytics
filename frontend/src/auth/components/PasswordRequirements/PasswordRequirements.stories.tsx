import type { Meta, StoryObj } from "@storybook/react-vite";
import { PasswordRequirements } from "./PasswordRequirements";

const meta = {
  component: PasswordRequirements,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof PasswordRequirements>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { password: "" },
};

export const Partial: Story = {
  args: { password: "abc" },
};

export const AllMet: Story = {
  args: { password: "Passw0rd!" },
};
