import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { MODULE_IDS } from "@/access/AccessContext";
import type { InstitutionSummary, InstitutionsSort } from "@/institutions/institutions.types";
import { getInstitutionColumns } from "./columns";
import { InstitutionsTable, type InstitutionsTableProps } from "./InstitutionsTable";

const INSTITUTIONS: InstitutionSummary[] = [
  {
    id: "inst-1",
    name: "Mazabuka Livelihoods Trust",
    region: "Southern",
    registered_users: 4685,
    active_users: 1643,
    module_started_pct: { "build-your-profile": 46, "job-readiness": 35, "career-explorer": 22, jobs: 31 },
    skills_reports: 1204,
  },
  {
    id: "inst-2",
    name: "Chipata Vocational Centre",
    region: "Eastern",
    registered_users: 4339,
    active_users: 1810,
    module_started_pct: { "build-your-profile": 52, "job-readiness": 37, "career-explorer": 22, jobs: 34 },
    skills_reports: 1187,
  },
  {
    id: "inst-3",
    name: "Kitwe Employment Network",
    region: "Copperbelt",
    registered_users: 1288,
    active_users: 525,
    module_started_pct: { "build-your-profile": 49, "job-readiness": 34, "career-explorer": 23, jobs: 42 },
    skills_reports: 165,
  },
];

const REGION_OPTIONS = [...new Set(INSTITUTIONS.map((institution) => institution.region))].map((region) => ({
  value: region,
  label: region,
}));

// Sort and filter are controlled, so the story owns them to keep the headers clickable.
function ControlledInstitutionsTable({ sort, selectedRegions, ...props }: Readonly<InstitutionsTableProps>) {
  const [currentSort, setCurrentSort] = useState<InstitutionsSort>(sort);
  const [regions, setRegions] = useState<readonly string[]>(selectedRegions);

  return (
    <InstitutionsTable
      {...props}
      sort={currentSort}
      onSortChange={setCurrentSort}
      selectedRegions={regions}
      onSelectedRegionsChange={setRegions}
    />
  );
}

const meta = {
  component: InstitutionsTable,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
  render: (args) => <ControlledInstitutionsTable {...args} />,
  args: {
    institutions: INSTITUTIONS,
    columns: getInstitutionColumns(Object.values(MODULE_IDS)),
    sort: { by: "registered_users", direction: "desc" },
    onSortChange: () => {},
    regionOptions: REGION_OPTIONS,
    selectedRegions: [],
    onSelectedRegionsChange: () => {},
    onClearFilters: () => {},
    onInstitutionSelect: () => {},
  },
} satisfies Meta<typeof InstitutionsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllModulesDeployed: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("columnheader", { name: /BYP % started/ })).toBeVisible();
    await expect(canvas.getByRole("columnheader", { name: /Jobs matched % users/ })).toBeVisible();
    await expect(canvas.getByRole("columnheader", { name: /Skills reports available/ })).toBeVisible();
    await expect(canvas.getByText("Mazabuka Livelihoods Trust")).toBeVisible();
  },
};

// A deployment running Build Your Profile alone: one module column, and its skills reports.
export const SingleModuleDeployed: Story = {
  args: { columns: getInstitutionColumns([MODULE_IDS.BUILD_YOUR_PROFILE]) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("columnheader", { name: /BYP % started/ })).toBeVisible();
    await expect(canvas.queryByRole("columnheader", { name: /Job readiness/ })).not.toBeInTheDocument();
  },
};

export const SortedByActiveUsers: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Sort by Active users" }));

    await waitFor(async () =>
      expect(canvas.getByRole("columnheader", { name: /Active users/ })).toHaveAttribute("aria-sort", "descending")
    );
  },
};

export const FilteringByRegion: Story = {
  play: async ({ canvasElement, canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Filter by Region" }));

    // The filter popover is portalled to the body, outside the story canvas.
    const menu = within(canvasElement.ownerDocument.body);
    await waitFor(async () => expect(menu.getByRole("checkbox", { name: "Eastern" })).toBeVisible());
    await userEvent.click(menu.getByRole("checkbox", { name: "Eastern" }));

    await expect(menu.getByText("1 selected")).toBeVisible();
  },
};

export const NoMatches: Story = {
  args: { institutions: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("No institutions match your search or filters.");
    await expect(canvas.getByRole("button", { name: "Clear search and filters" })).toBeVisible();
  },
};
