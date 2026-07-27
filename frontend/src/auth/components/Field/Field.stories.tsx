import type { Meta, StoryObj } from "@storybook/react-vite";
import { Mail } from "lucide-react";
import { Field } from "./Field";

const meta = {
  component: Field,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  args: {
    id: "email",
    label: "Email",
    placeholder: "you@partner.org",
    type: "email",
    icon: <Mail />,
  },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = {
  args: { defaultValue: "you@partner.org" },
};

export const WithError: Story = {
  args: { error: "Enter a valid email address." },
};

export const VisibleLabel: Story = {
  args: { labelHidden: false },
};
