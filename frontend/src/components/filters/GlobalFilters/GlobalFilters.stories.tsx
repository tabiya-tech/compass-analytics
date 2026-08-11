import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { GlobalFilters } from "./GlobalFilters";
import { AccessProvider, type AccessScope } from "@/access/AccessContext";
import { FiltersProvider } from "@/filters/FiltersContext";
import { createInitialFilters, type FiltersState } from "@/filters/filters";

const GIVEN_TODAY = new Date(2026, 5, 15);
const ALL_INSTITUTIONS: AccessScope = { type: "all" };

function withState(filters: Partial<FiltersState>, scope: AccessScope = ALL_INSTITUTIONS) {
  return (Story: () => React.ReactElement) => (
    <AccessProvider scope={scope}>
      <FiltersProvider initialFilters={{ ...createInitialFilters(GIVEN_TODAY), ...filters }}>
        <Story />
      </FiltersProvider>
    </AccessProvider>
  );
}

const meta = {
  title: "Filters/GlobalFilters",
  component: GlobalFilters,
  tags: ["autodocs"],
} satisfies Meta<typeof GlobalFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoFilters: Story = {
  decorators: [withState({})],
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No filters applied")).toBeVisible();
  },
};

export const AllFilters: Story = {
  decorators: [withState({ institutionDrillDownId: "inst-1", audienceSegment: "youth", loginMethod: "email" })],
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Institution: inst-1")).toBeVisible();
    await expect(canvas.getByText("Audience segment: Youth")).toBeVisible();
    await expect(canvas.getByText("Login method: Email")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Clear all" })).toBeVisible();
  },
};

export const SingleFilter: Story = {
  decorators: [withState({ audienceSegment: "women" })],
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Audience segment: Women")).toBeVisible();
  },
};

export const SingleInstitutionScope: Story = {
  decorators: [
    withState(
      { institutionDrillDownId: "inst-1", audienceSegment: "women" },
      { type: "institutions", institutionIds: ["inst-1"] }
    ),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.queryByText(/Institution:/)).not.toBeInTheDocument();
    await expect(canvas.getByText("Audience segment: Women")).toBeVisible();
  },
};
