import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { MODULE_IDS } from "@/access/AccessContext";
import { DATA_TEST_ID as STAT_TILE_TEST_ID } from "@/components/shared/StatTile";
import type {
  BuildYourProfileMetrics,
  CareerExplorerMetrics,
  JobReadinessMetrics,
  JobsMetrics,
} from "@/pages/Modules/types";
import { ModuleBody } from "./ModuleBody";

const BUILD_YOUR_PROFILE: BuildYourProfileMetrics = {
  moduleId: MODULE_IDS.BUILD_YOUR_PROFILE,
  startedPercentage: 44,
  cvsGenerated: 502,
  cvsGeneratedSharePercentage: 28,
  averageMinutesToComplete: 12,
  targetMinutes: 15,
  phases: [
    { id: "intro", reached: 1798 },
    { id: "experiences", reached: 1546 },
    { id: "skills", reached: 1150 },
    { id: "review", reached: 718 },
    { id: "completed", reached: 502 },
  ],
};

const JOB_READINESS: JobReadinessMetrics = {
  moduleId: MODULE_IDS.JOB_READINESS,
  startedPercentage: 34,
  subModules: [
    { id: "cv-builder", name: "CV Builder", started: 1016, completed: 561 },
    { id: "interview-prep", name: "Interview Prep", started: 1415, completed: 926 },
    { id: "workplace-skills", name: "Workplace Skills", started: 1073, completed: 724 },
    { id: "digital-basics", name: "Digital Basics", started: 892, completed: 438 },
  ],
};

const CAREER_EXPLORER: CareerExplorerMetrics = {
  moduleId: MODULE_IDS.CAREER_EXPLORER,
  startedPercentage: 18,
  topSectors: [
    { id: "healthcare", label: "Healthcare", explorations: 188 },
    { id: "technology", label: "Technology", explorations: 152 },
    { id: "green-jobs", label: "Green jobs", explorations: 137 },
    { id: "education", label: "Education", explorations: 130 },
    { id: "finance", label: "Finance", explorations: 116 },
  ],
};

const JOBS: JobsMetrics = {
  moduleId: MODULE_IDS.JOBS,
  startedPercentage: 26,
  jobsSourced: 30610,
  profilesWithMatches: 879,
  profilesWithMatchesSharePercentage: 21,
  jobsViewedPerUser: 8.4,
  topCategories: [
    { id: "retail-sales", label: "Retail & sales", matches: 252 },
    { id: "hospitality", label: "Hospitality", matches: 216 },
    { id: "construction", label: "Construction", matches: 180 },
    { id: "agriculture", label: "Agriculture", matches: 153 },
    { id: "logistics", label: "Logistics", matches: 121 },
  ],
};

const meta = {
  component: ModuleBody,
  tags: ["autodocs"],
  args: { metrics: BUILD_YOUR_PROFILE },
  decorators: [
    (Story) => (
      <div className="w-260 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ModuleBody>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BuildYourProfile: Story = {
  play: async ({ canvas }) => {
    const tile = canvas.getAllByTestId(STAT_TILE_TEST_ID.CONTAINER)[0];
    await expect(within(tile).getByText("502")).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Conversation funnel" })).toBeVisible();
  },
};

export const BuildYourProfileSlowAndLeaky: Story = {
  args: {
    metrics: {
      ...BUILD_YOUR_PROFILE,
      averageMinutesToComplete: 21.4,
      cvsGenerated: 96,
      cvsGeneratedSharePercentage: 5,
      phases: [
        { id: "intro", reached: 1798 },
        { id: "experiences", reached: 604 },
        { id: "skills", reached: 380 },
        { id: "review", reached: 180 },
        { id: "completed", reached: 96 },
      ],
    },
  },
};

export const JobReadinessCourses: Story = {
  args: { metrics: JOB_READINESS },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("561 completed · 1,016 started")).toBeVisible();
    await expect(canvas.getByText("Completed")).toBeVisible();
  },
};

export const CareerExplorerSectors: Story = {
  args: { metrics: CAREER_EXPLORER },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("list", { name: "Top sectors & careers explored" })).toBeVisible();
  },
};

export const JobsMatching: Story = {
  args: { metrics: JOBS },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("30,610")).toBeVisible();
    await expect(canvas.getByText("879")).toBeVisible();
    await expect(canvas.getByText("8.4")).toBeVisible();
  },
};

export const NothingToShow: Story = {
  args: { metrics: { ...CAREER_EXPLORER, topSectors: [] } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No data to show for this selection.")).toBeVisible();
  },
};
