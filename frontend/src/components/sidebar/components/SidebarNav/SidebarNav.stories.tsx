import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { SidebarNav } from "./SidebarNav";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AccessProvider, MODULE_IDS } from "@/access/AccessContext";
import { buildAbility } from "@/access/ability";

const meta = {
  title: "Sidebar/SidebarNav",
  component: SidebarNav,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <SidebarProvider>
        <Story />
      </SidebarProvider>
    ),
  ],
} satisfies Meta<typeof SidebarNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullAccess: Story = {
  decorators: [
    (Story) => (
      <AccessProvider ability={buildAbility(["dashboard:view", "jobseekers:view"])}>
        <Story />
      </AccessProvider>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: /^Overview$/ })).toBeVisible();
    await expect(canvas.getByRole("link", { name: /Jobseekers/ })).toBeVisible();
    await expect(canvas.getByRole("link", { name: /^Modules$/ })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Build Your Profile" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Job readiness" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Career Explorer" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Jobs" })).toBeVisible();
  },
};

export const JobseekersHidden: Story = {
  decorators: [
    (Story) => (
      <AccessProvider ability={buildAbility(["dashboard:view"])}>
        <Story />
      </AccessProvider>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: /^Overview$/ })).toBeVisible();
    await expect(canvas.queryByRole("link", { name: /Jobseekers/ })).not.toBeInTheDocument();
  },
};

export const MinimalAccess: Story = {
  decorators: [
    (Story) => (
      <AccessProvider ability={buildAbility(["dashboard:view"])} activeModules={[]}>
        <Story />
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
      <AccessProvider activeModules={[MODULE_IDS.BUILD_YOUR_PROFILE]}>
        <Story />
      </AccessProvider>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("link", { name: /^Modules$/ })).not.toBeInTheDocument();
  },
};
