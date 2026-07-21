import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

const meta = {
  component: AppSidebar,
  tags: ["ai-generated"],
  decorators: [
    (Story) => (
      <SidebarProvider>
        <Story />
      </SidebarProvider>
    ),
  ],
} satisfies Meta<typeof AppSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Compass Analytics")).toBeVisible();
    await expect(canvas.getByAltText("Tabiya")).toBeVisible();
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
};
