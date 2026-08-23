import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { MODULE_IDS } from "@/access/AccessContext";
import type { JobseekerModuleProgress } from "@/jobseekers/jobseekers.types";
import { ModuleProgressList } from "./ModuleProgressList";

const MODULES: JobseekerModuleProgress[] = [
  { module_id: MODULE_IDS.BUILD_YOUR_PROFILE, status: "in_progress", phase: "Skills" },
  {
    module_id: MODULE_IDS.JOB_READINESS,
    status: "in_progress",
    sub_modules: [
      { id: "cv-builder", name: "CV Builder", status: "completed" },
      { id: "interview-prep", name: "Interview Prep", status: "in_progress" },
      { id: "workplace-skills", name: "Workplace Skills", status: "not_started" },
      { id: "digital-basics", name: "Digital Basics", status: "not_started" },
    ],
  },
  { module_id: MODULE_IDS.CAREER_EXPLORER, status: "not_started" },
  { module_id: MODULE_IDS.JOBS, status: "completed" },
];

const meta = {
  component: ModuleProgressList,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { modules: MODULES },
} satisfies Meta<typeof ModuleProgressList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PartWayThrough: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Phase: Skills")).toBeVisible();
    await expect(canvas.getByText("1/4 modules completed")).toBeVisible();
    await expect(canvas.getByText("Career Explorer")).toBeVisible();
  },
};

// Nothing started yet: no phase, no steps, every module reading as not started.
export const NothingStarted: Story = {
  args: {
    modules: MODULES.map((module) => ({ ...module, status: "not_started" as const, phase: undefined })),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText("Not started")).toHaveLength(MODULES.length);
  },
};

export const AllCompleted: Story = {
  args: {
    modules: MODULES.map((module) => ({
      ...module,
      status: "completed" as const,
      phase: module.phase ? "Completed" : undefined,
      sub_modules: module.sub_modules?.map((step) => ({ ...step, status: "completed" as const })),
    })),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("4/4 modules completed")).toBeVisible();
  },
};
