import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { MODULE_IDS } from "@/access/AccessContext";
import type { JobseekerSummary, JobseekersSort, ModuleStatusFilters } from "@/jobseekers/jobseekers.types";
import { getJobseekerColumns } from "./columns";
import { JobseekersTable, type JobseekersTableProps } from "./JobseekersTable";

const JOBSEEKERS: JobseekerSummary[] = [
  {
    id: "JS-10230",
    name: "María González",
    institution_id: "inst-1",
    institution_name: "Mazabuka Livelihoods Trust",
    profile_score_pct: 100,
    registered_at: "2026-02-05",
    last_login_at: "2026-07-04",
    module_status: {
      "build-your-profile": "completed",
      "job-readiness": "completed",
      "career-explorer": "completed",
      jobs: "in_progress",
    },
    skills_report_ready: true,
    skills: ["Customer service", "Cash handling", "Inventory management"],
  },
  {
    id: "JS-10231",
    name: "Kwame Osei",
    institution_id: "inst-1",
    institution_name: "Mazabuka Livelihoods Trust",
    profile_score_pct: 70,
    registered_at: "2026-02-09",
    last_login_at: "2026-06-25",
    module_status: {
      "build-your-profile": "in_progress",
      "job-readiness": "not_started",
      "career-explorer": "in_progress",
      jobs: "completed",
    },
    skills_report_ready: false,
    skills: [],
  },
  {
    id: "JS-10242",
    name: "Kabelo Molefe",
    institution_id: "inst-1",
    institution_name: "Mazabuka Livelihoods Trust",
    profile_score_pct: 0,
    registered_at: "2026-03-28",
    last_login_at: "2026-04-10",
    module_status: {
      "build-your-profile": "not_started",
      "job-readiness": "not_started",
      "career-explorer": "not_started",
      jobs: "not_started",
    },
    skills_report_ready: false,
    skills: [],
  },
];

// Sort and filter are controlled, so the story owns them to keep the headers clickable.
function ControlledJobseekersTable({ sort, moduleStatusFilters, ...props }: Readonly<JobseekersTableProps>) {
  const [currentSort, setCurrentSort] = useState<JobseekersSort>(sort);
  const [filters, setFilters] = useState<ModuleStatusFilters>(moduleStatusFilters);

  return (
    <JobseekersTable
      {...props}
      sort={currentSort}
      onSortChange={setCurrentSort}
      moduleStatusFilters={filters}
      onModuleStatusFiltersChange={setFilters}
    />
  );
}

const meta = {
  component: ControlledJobseekersTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    jobseekers: JOBSEEKERS,
    columns: getJobseekerColumns(Object.values(MODULE_IDS)),
    sort: { by: "name", direction: "asc" },
    onSortChange: () => {},
    moduleStatusFilters: {},
    onModuleStatusFiltersChange: () => {},
    onClearFilters: () => {},
    onJobseekerSelect: () => {},
    onSkillsSelect: () => {},
  },
} satisfies Meta<typeof ControlledJobseekersTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllModulesDeployed: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("JS-10230")).toBeVisible();
    // Jobs never gets a column of its own — it lives in the profile drill-down.
    await expect(canvas.queryByRole("button", { name: "Filter by Jobs" })).not.toBeInTheDocument();
  },
};

// A deployment running Build Your Profile only.
export const OneModuleDeployed: Story = {
  args: { columns: getJobseekerColumns([MODULE_IDS.BUILD_YOUR_PROFILE]) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Filter by Build Your Profile" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Filter by Career Explorer" })).not.toBeInTheDocument();
  },
};

export const SortedByProfileScore: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Sort by Profile score" }));
    await waitFor(async () =>
      expect(canvas.getByRole("columnheader", { name: /Profile score/ })).toHaveAttribute("aria-sort", "descending")
    );
  },
};

export const FilteringByModuleStatus: Story = {
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Filter by Build Your Profile" }));

    // The popover is portalled to the body, outside the story canvas.
    const popover = within(canvasElement.ownerDocument.body);
    await waitFor(async () => expect(popover.getByRole("checkbox", { name: "Completed" })).toBeVisible());
  },
};

export const NoMatches: Story = {
  args: { jobseekers: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("No jobseekers match your search or filters.");
  },
};
