import type { Meta, StoryObj } from "@storybook/react-vite";
import { AuthLayout } from "./AuthLayout";

const meta = {
  component: AuthLayout,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AuthLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-3xl font-bold text-foreground">Form panel</h2>
          <p className="text-muted-foreground">Each page renders its content in this slot.</p>
        </div>
        <div className="flex h-12 items-center rounded-card border border-border bg-card px-4 text-sm text-muted-foreground">
          Field
        </div>
        <div className="flex h-12 items-center rounded-card border border-border bg-card px-4 text-sm text-muted-foreground">
          Field
        </div>
        <div className="flex h-12 items-center justify-center rounded-pill bg-tabiya-green font-semibold text-tabiya-blue">
          Action
        </div>
      </div>
    ),
  },
};
