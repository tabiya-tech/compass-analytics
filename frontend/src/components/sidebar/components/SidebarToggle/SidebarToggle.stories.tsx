import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarToggle } from "./SidebarToggle";

const meta = {
  title: "Sidebar/SidebarToggle",
  component: SidebarToggle,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <SidebarProvider>
        <Story />
      </SidebarProvider>
    ),
  ],
} satisfies Meta<typeof SidebarToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
  },
};

export const Collapsed: Story = {
  decorators: [
    (Story) => (
      <SidebarProvider defaultOpen={false}>
        <Story />
      </SidebarProvider>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  },
};

export const Toggling: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Collapse sidebar" }));
    await expect(canvas.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  },
};
