import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";
import { SidebarUserMenu } from "./sidebar-user-menu";
import { SidebarProvider } from "@/components/ui/sidebar";

const meta = {
  title: "Sidebar/SidebarUserMenu",
  component: SidebarUserMenu,
  tags: ["autodocs"],
  args: { onSignOut: fn() },
  decorators: [
    (Story) => (
      <SidebarProvider>
        <div className="w-64 bg-sidebar p-2">
          <Story />
        </div>
      </SidebarProvider>
    ),
  ],
} satisfies Meta<typeof SidebarUserMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Open account menu" })).toBeVisible();
  },
};
