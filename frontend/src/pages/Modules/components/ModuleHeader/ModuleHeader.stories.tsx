import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { MODULE_IDS } from "@/access/AccessContext";
import { ModuleHeader } from "./ModuleHeader";

const meta = {
  component: ModuleHeader,
  tags: ["autodocs"],
  args: { moduleId: MODULE_IDS.BUILD_YOUR_PROFILE },
  decorators: [
    (Story) => (
      <div className="w-240 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ModuleHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BuildYourProfile: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Are people building their profiles?" })).toBeVisible();
  },
};

export const JobReadiness: Story = {
  args: { moduleId: MODULE_IDS.JOB_READINESS },
};

export const CareerExplorer: Story = {
  args: { moduleId: MODULE_IDS.CAREER_EXPLORER },
};

export const Jobs: Story = {
  args: { moduleId: MODULE_IDS.JOBS },
};
