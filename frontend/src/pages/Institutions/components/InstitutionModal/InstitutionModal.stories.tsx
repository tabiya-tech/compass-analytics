import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { MODULE_IDS } from "@/access/AccessContext";
import type { InstitutionDetail } from "@/institutions/institutions.types";
import { InstitutionModal } from "./InstitutionModal";

const DETAIL: InstitutionDetail = {
  id: "inst-2",
  name: "Chipata Vocational Centre",
  city: "Chipata",
  region: "Eastern",
  lead_pm: "Isaac Chirwa",
  profile_score_pct: 28,
  reach: {
    registered_users: 4339,
    active_users_30d: 1810,
    top_age_band: "18–24",
    largest_group: "Women",
    most_common_education: "Secondary",
  },
  login_activity: {
    avg_logins_per_user: 3.4,
    total_logins: 8733,
    avg_session_minutes: 8,
    google_login_pct: 58,
    email_login_pct: 42,
  },
  modules: [
    { module_id: MODULE_IDS.BUILD_YOUR_PROFILE, started_pct: 52, highlight_value: 634 },
    {
      module_id: MODULE_IDS.JOB_READINESS,
      started_pct: 37,
      sub_modules: [
        { id: "cv-builder", name: "CV Builder", started: 1618, completed_pct: 47 },
        { id: "interview-prep", name: "Interview Prep", started: 1164, completed_pct: 63 },
        { id: "workplace-skills", name: "Workplace Skills", started: 1512, completed_pct: 52 },
        { id: "digital-basics", name: "Digital Basics", started: 793, completed_pct: 64 },
      ],
    },
    { module_id: MODULE_IDS.CAREER_EXPLORER, started_pct: 22, highlight_value: 973 },
    { module_id: MODULE_IDS.JOBS, started_pct: 34, highlight_value: 1290 },
  ],
  outputs: {
    skills_reports_generated: 634,
    downloaded: 394,
    jobs_sourced: 19_500,
    avg_time_to_complete_minutes: 12.3,
    target_minutes: 15,
  },
};

const meta = {
  component: InstitutionModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    state: { status: "success", data: DETAIL },
    onOpenChange: () => {},
  },
} satisfies Meta<typeof InstitutionModal>;

export default meta;
type Story = StoryObj<typeof meta>;

// The dialog is portalled to the body, so stories assert against it rather than the canvas.
const dialog = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body);

export const AllModulesDeployed: Story = {
  play: async ({ canvasElement }) => {
    const modal = dialog(canvasElement);
    await expect(modal.getByRole("dialog", { name: /Chipata Vocational Centre/ })).toBeVisible();
    await expect(modal.getByText("Chipata · Eastern · Lead: Isaac Chirwa")).toBeVisible();
    await expect(modal.getByText("634 skills reports")).toBeVisible();
    await expect(modal.getByText("1,618 started · 47% completed")).toBeVisible();
  },
};

// A deployment without Build Your Profile: no profile ring, no outputs, no completion time.
export const WithoutBuildYourProfile: Story = {
  args: {
    state: {
      status: "success",
      data: {
        ...DETAIL,
        profile_score_pct: undefined,
        outputs: undefined,
        modules: DETAIL.modules.filter((module) => module.module_id !== MODULE_IDS.BUILD_YOUR_PROFILE),
      },
    },
  },
  play: async ({ canvasElement }) => {
    const modal = dialog(canvasElement);
    await expect(modal.queryByRole("progressbar")).not.toBeInTheDocument();
    await expect(modal.queryByText("Outputs")).not.toBeInTheDocument();
  },
};

// The dialog fades in, so these wait for the animation to settle before asserting visibility.
export const Loading: Story = {
  args: { state: { status: "loading" } },
  play: async ({ canvasElement }) => {
    const modal = dialog(canvasElement);
    await waitFor(async () => expect(modal.getByRole("dialog", { name: "Institution detail" })).toBeVisible());
    await expect(modal.getByRole("status")).toHaveAttribute("aria-busy", "true");
  },
};

export const Error: Story = {
  args: { state: { status: "error", retry: () => {} } },
  play: async ({ canvasElement }) => {
    await waitFor(async () =>
      expect(dialog(canvasElement).getByText("Failed to load this institution.")).toBeVisible()
    );
  },
};
