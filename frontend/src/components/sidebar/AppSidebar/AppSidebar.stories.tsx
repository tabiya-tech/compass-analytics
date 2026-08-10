import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AccessProvider } from "@/access/AccessContext";
import { PERMISSIONS, MODULE_IDS } from "@/access/AccessContext";

const meta = {
  title: "Sidebar/AppSidebar",
  component: AppSidebar,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <AccessProvider>
        <SidebarProvider>
          <Story />
        </SidebarProvider>
      </AccessProvider>
    ),
  ],
} satisfies Meta<typeof AppSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Compass Analytics")).toBeVisible();
    await expect(canvas.getByAltText("Compass Analytics")).toBeVisible();
    await expect(canvas.getByRole("link", { name: /^Overview$/ })).toBeVisible();
  },
};

export const Collapsed: Story = {
  decorators: [
    (Story) => (
      <AccessProvider>
        <SidebarProvider defaultOpen={false}>
          <Story />
        </SidebarProvider>
      </AccessProvider>
    ),
  ],
};

export const FullAccess: Story = {
  decorators: [
    (Story) => (
      <AccessProvider>
        <SidebarProvider>
          <Story />
        </SidebarProvider>
      </AccessProvider>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: /Jobseekers/ })).toBeVisible();
    await expect(canvas.getByRole("link", { name: /^Modules$/ })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Build Your Profile" })).toBeVisible();
  },
};

export const MinimalAccess: Story = {
  decorators: [
    (Story) => (
      <AccessProvider
        access={{
          permissions: new Set([PERMISSIONS.DASHBOARD_VIEW]),
          activeModules: [],
        }}
      >
        <SidebarProvider>
          <Story />
        </SidebarProvider>
      </AccessProvider>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: /^Overview$/ })).toBeVisible();
    await expect(canvas.queryByRole("link", { name: /Jobseekers/ })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("link", { name: /^Modules$/ })).not.toBeInTheDocument();
  },
};

export const SingleActiveModule: Story = {
  decorators: [
    (Story) => (
      <AccessProvider access={{ activeModules: [MODULE_IDS.BUILD_YOUR_PROFILE] }}>
        <SidebarProvider>
          <Story />
        </SidebarProvider>
      </AccessProvider>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("link", { name: /^Modules$/ })).not.toBeInTheDocument();
  },
};
