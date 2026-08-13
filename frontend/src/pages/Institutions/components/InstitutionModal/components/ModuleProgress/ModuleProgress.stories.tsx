import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { MODULE_IDS } from "@/access/AccessContext";
import type { InstitutionModuleProgress } from "@/institutions/institutions.types";
import { ModuleProgress } from "./ModuleProgress";

const BUILD_YOUR_PROFILE: InstitutionModuleProgress = {
  module_id: MODULE_IDS.BUILD_YOUR_PROFILE,
  started_pct: 52,
  highlight_value: 634,
};

const JOB_READINESS: InstitutionModuleProgress = {
  module_id: MODULE_IDS.JOB_READINESS,
  started_pct: 37,
  sub_modules: [
    { id: "cv-builder", name: "CV Builder", started: 1618, completed_pct: 47 },
    { id: "interview-prep", name: "Interview Prep", started: 1164, completed_pct: 63 },
    { id: "workplace-skills", name: "Workplace Skills", started: 1512, completed_pct: 52 },
    { id: "digital-basics", name: "Digital Basics", started: 793, completed_pct: 64 },
  ],
};

const CAREER_EXPLORER: InstitutionModuleProgress = {
  module_id: MODULE_IDS.CAREER_EXPLORER,
  started_pct: 22,
  highlight_value: 973,
};

const JOBS: InstitutionModuleProgress = { module_id: MODULE_IDS.JOBS, started_pct: 34, highlight_value: 1290 };

const meta = {
  component: ModuleProgress,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="max-w-2xl rounded-card bg-card p-6">
        <Story />
      </div>
    ),
  ],
  args: { modules: [BUILD_YOUR_PROFILE, JOB_READINESS, CAREER_EXPLORER, JOBS] },
} satisfies Meta<typeof ModuleProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllModulesDeployed: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("634 skills reports")).toBeVisible();
    await expect(canvas.getByText("1,290 with a match")).toBeVisible();
    await expect(canvas.getByText("52% started")).toBeVisible();
  },
};

// Job readiness is the one module that breaks down into steps.
export const WithSubModules: Story = {
  args: { modules: [JOB_READINESS] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Get Job Ready")).toBeVisible();
    await expect(canvas.getByText("1,618 started · 47% completed")).toBeVisible();
  },
};

export const SingleModuleDeployed: Story = {
  args: { modules: [BUILD_YOUR_PROFILE] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Build Your Profile")).toBeVisible();
    await expect(canvas.queryByText("Job readiness")).not.toBeInTheDocument();
  },
};
