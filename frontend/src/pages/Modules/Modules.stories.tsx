import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { delay, http, HttpResponse } from "msw";
import { AccessProvider, MODULE_IDS, type AccessScope, type ModuleId } from "@/access/AccessContext";
import { FiltersProvider } from "@/filters/FiltersContext";
import { createInitialFilters } from "@/filters/filters";
import { DATA_TEST_ID as TIMELINE_TEST_ID } from "@/pages/Modules/components/ModuleTimeline";
import { buildYourProfileHandler, jobsHandler } from "@/mocks/handlers";
import { MODULES_API_BASE } from "@/pages/Modules/services/ModuleMetrics.service";
import { Modules, DATA_TEST_ID } from "./Modules";

const FIXED_FILTERS = {
  ...createInitialFilters(new Date(2026, 6, 7)),
  dateRange: { start: "2025-07-08", end: "2026-07-07" },
  granularity: "month" as const,
};

const ONE_INSTITUTION: AccessScope = { type: "institutions", institutionIds: ["inst-1"] };

function withDeployment(activeModules: readonly ModuleId[], scope: AccessScope = ONE_INSTITUTION): Decorator {
  return (Story) => (
    <AccessProvider scope={scope} activeModules={activeModules}>
      <FiltersProvider initialFilters={FIXED_FILTERS}>
        <Story />
      </FiltersProvider>
    </AccessProvider>
  );
}

const meta = {
  component: Modules,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Modules>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  decorators: [withDeployment(Object.values(MODULE_IDS))],
};

export const ThreeModuleDeployment: Story = {
  decorators: [withDeployment([MODULE_IDS.BUILD_YOUR_PROFILE, MODULE_IDS.JOB_READINESS, MODULE_IDS.JOBS])],
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getAllByTestId(TIMELINE_TEST_ID.STEP)).toHaveLength(3));
    await expect(canvas.queryByRole("heading", { name: "Are people exploring careers?" })).not.toBeInTheDocument();
  },
};

export const TwoModuleDeployment: Story = {
  decorators: [withDeployment([MODULE_IDS.CAREER_EXPLORER, MODULE_IDS.JOBS])],
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getAllByTestId(DATA_TEST_ID.SECTION)).toHaveLength(2));
  },
};

export const Loading: Story = {
  decorators: [withDeployment(Object.values(MODULE_IDS))],
  parameters: {
    msw: {
      handlers: [http.get(`${MODULES_API_BASE}/build-your-profile`, async () => await delay("infinite"))],
    },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  },
};

// The equivalent assertions live in Modules.test.tsx (jsdom, not flaky under load) — this story
// is a visual/manual-QA fixture, not an interaction test.
export const BuildYourProfileUnavailable: Story = {
  decorators: [withDeployment(Object.values(MODULE_IDS))],
  parameters: {
    msw: {
      handlers: [
        http.get(`${MODULES_API_BASE}/build-your-profile`, () => new HttpResponse(null, { status: 500 })),
        jobsHandler,
      ],
    },
  },
};

// The equivalent assertions live in Modules.test.tsx (jsdom, not flaky under load) — this story
// is a visual/manual-QA fixture, not an interaction test.
export const JobsUnavailable: Story = {
  decorators: [withDeployment(Object.values(MODULE_IDS))],
  parameters: {
    msw: {
      handlers: [
        buildYourProfileHandler,
        http.get(`${MODULES_API_BASE}/jobs`, () => new HttpResponse(null, { status: 500 })),
      ],
    },
  },
};
