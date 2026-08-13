import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { delay, http, HttpResponse } from "msw";
import { AccessProvider, type AccessScope } from "@/access/AccessContext";
import { FiltersProvider } from "@/filters/FiltersContext";
import { createInitialFilters } from "@/filters/filters";
import { OVERVIEW_API_BASE } from "@/pages/Overview/services/OverviewMetrics.service";
import { Overview } from "./Overview";

const FIXED_FILTERS = {
  ...createInitialFilters(new Date(2026, 6, 7)),
  dateRange: { start: "2025-07-08", end: "2026-07-07" },
  granularity: "month" as const,
};

function withAccess(scope: AccessScope): Decorator {
  return (Story) => (
    <AccessProvider scope={scope}>
      <FiltersProvider initialFilters={FIXED_FILTERS}>
        <Story />
      </FiltersProvider>
    </AccessProvider>
  );
}

const meta = {
  component: Overview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Overview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  decorators: [withAccess({ type: "all" })],
};

export const Loading: Story = {
  decorators: [withAccess({ type: "institutions", institutionIds: ["inst-1"] })],
  parameters: {
    msw: { handlers: [http.get(`${OVERVIEW_API_BASE}/metrics`, async () => await delay("infinite"))] },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  },
};

export const FailedToLoad: Story = {
  decorators: [withAccess({ type: "institutions", institutionIds: ["inst-1"] })],
  parameters: {
    msw: { handlers: [http.get(`${OVERVIEW_API_BASE}/metrics`, () => new HttpResponse(null, { status: 500 }))] },
  },
  play: async ({ canvas }) => {
    await waitFor(() => canvas.getByText("We couldn't load the dashboard metrics."));
    await expect(canvas.getByRole("button", { name: "Retry" })).toBeVisible();
  },
};
