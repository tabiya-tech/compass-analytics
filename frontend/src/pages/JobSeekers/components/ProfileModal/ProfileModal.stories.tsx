import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { AccessProvider, MODULE_IDS } from "@/access/AccessContext";
import type { JobseekerDetail } from "@/jobseekers/jobseekers.types";
import { ProfileModal } from "./ProfileModal";

const DETAIL: JobseekerDetail = {
  id: "JS-10230",
  name: "María González",
  institution_id: "inst-1",
  institution_name: "Mazabuka Livelihoods Trust",
  profile_score_pct: 70,
  demographics: { gender: "Female", age: 24, location: "Mazabuka", education: "Secondary" },
  login_activity: {
    registered_at: "2026-02-05",
    last_login_at: "2026-07-04",
    total_logins: 14,
    login_method: "google",
  },
  modules: [
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
  ],
  outputs: { skills_report_generated: true, downloaded: true, shared: false },
  skills: ["Customer service", "Cash handling"],
};

const meta = {
  component: ProfileModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <AccessProvider>
        <Story />
      </AccessProvider>
    ),
  ],
  args: { open: true, onOpenChange: () => {}, onViewSkills: () => {} },
} satisfies Meta<typeof ProfileModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  args: { state: { status: "success", data: DETAIL } },
  play: async ({ canvasElement }) => {
    // The dialog is portalled to the body, outside the story canvas.
    const modal = within(canvasElement.ownerDocument.body);
    await waitFor(async () => expect(modal.getByRole("heading", { name: "María González" })).toBeVisible());
    await expect(modal.getByText("JS-10230 · Mazabuka Livelihoods Trust")).toBeVisible();
    await expect(modal.getByText("1/4 modules completed")).toBeVisible();
  },
};

// A jobseeker who has finished everything, so the Skills Report is theirs to download and share.
export const ProfileComplete: Story = {
  args: {
    state: {
      status: "success",
      data: {
        ...DETAIL,
        profile_score_pct: 100,
        modules: DETAIL.modules.map((module) => ({
          ...module,
          status: "completed" as const,
          phase: module.phase ? "Completed" : undefined,
          sub_modules: module.sub_modules?.map((step) => ({ ...step, status: "completed" as const })),
        })),
        outputs: { skills_report_generated: true, downloaded: true, shared: true },
      },
    },
  },
};

// Nothing started, so there is no report to offer.
export const NoReportYet: Story = {
  args: {
    state: {
      status: "success",
      data: {
        ...DETAIL,
        profile_score_pct: 5,
        modules: DETAIL.modules.map((module) => ({
          ...module,
          status: "not_started" as const,
          phase: undefined,
          sub_modules: module.sub_modules?.map((step) => ({ ...step, status: "not_started" as const })),
        })),
        outputs: { skills_report_generated: false, downloaded: false, shared: false },
        skills: [],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const modal = within(canvasElement.ownerDocument.body);
    await waitFor(async () => expect(modal.getByText(/No skills yet/)).toBeVisible());
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const Error: Story = {
  args: { state: { status: "error", retry: () => {} } },
  play: async ({ canvasElement }) => {
    const modal = within(canvasElement.ownerDocument.body);
    await waitFor(async () => expect(modal.getByText("Failed to load this jobseeker's profile.")).toBeVisible());
  },
};
