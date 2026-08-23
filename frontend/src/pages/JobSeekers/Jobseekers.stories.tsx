import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { http, HttpResponse, delay } from "msw";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { AuthContext } from "@/auth/AuthContext";
import { AccessProvider, MODULE_IDS, type AccessProviderProps } from "@/access/AccessContext";
import { Jobseekers } from "./Jobseekers";

/** Storybook gives the story router, i18n and MSW — but not auth, so stub a signed-in user here. */
function JobseekersHarness({ access, children }: Readonly<{ access?: AccessProviderProps; children: ReactNode }>) {
  return (
    <AuthContext.Provider value={{ user: null, loading: false, getIdToken: async () => "storybook-token" }}>
      <AccessProvider {...access}>{children}</AccessProvider>
    </AuthContext.Provider>
  );
}

const meta = {
  component: Jobseekers,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <JobseekersHarness>
        <Story />
      </JobseekersHarness>
    ),
  ],
} satisfies Meta<typeof Jobseekers>;

export default meta;
type Story = StoryObj<typeof meta>;

// The shared MSW handlers serve the mocked roster, scoped to the granted institution.
export const AllModulesDeployed: Story = {
  play: async ({ canvas }) => {
    await waitFor(async () => expect(canvas.getByRole("button", { name: /Aisha Mwansa/ })).toBeVisible());
    await expect(canvas.getByText("21 jobseekers")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Filter by Build Your Profile" })).toBeVisible();
  },
};

// A deployment running Build Your Profile and Job readiness only.
export const TwoModulesDeployed: Story = {
  decorators: [
    (Story) => (
      <JobseekersHarness access={{ activeModules: [MODULE_IDS.BUILD_YOUR_PROFILE, MODULE_IDS.JOB_READINESS] }}>
        <Story />
      </JobseekersHarness>
    ),
  ],
  play: async ({ canvas }) => {
    await waitFor(async () =>
      expect(canvas.getByRole("button", { name: "Filter by Build Your Profile" })).toBeVisible()
    );
    await expect(canvas.queryByRole("button", { name: "Filter by Career Explorer" })).not.toBeInTheDocument();
  },
};

// A grant covering the whole deployment sees every institution's jobseekers.
export const DeploymentWideGrant: Story = {
  decorators: [
    (Story) => (
      <JobseekersHarness access={{ scope: { type: "all" } }}>
        <Story />
      </JobseekersHarness>
    ),
  ],
  play: async ({ canvas }) => {
    await waitFor(async () => expect(canvas.getByText("28 jobseekers")).toBeVisible());
  },
};

export const Searching: Story = {
  play: async ({ canvas }) => {
    await waitFor(async () => expect(canvas.getByRole("button", { name: /Aisha Mwansa/ })).toBeVisible());

    await userEvent.type(canvas.getByRole("searchbox", { name: "Search jobseekers by name or ID" }), "gonz");

    await waitFor(async () => expect(canvas.getByText("1 jobseeker")).toBeVisible());
  },
};

export const NoMatches: Story = {
  play: async ({ canvas }) => {
    await waitFor(async () => expect(canvas.getByRole("button", { name: /Aisha Mwansa/ })).toBeVisible());

    await userEvent.type(canvas.getByRole("searchbox", { name: "Search jobseekers by name or ID" }), "no such person");

    await waitFor(async () =>
      expect(canvas.getByRole("status")).toHaveTextContent("No jobseekers match your search or filters.")
    );
  },
};

// The profile drill-down, opened the way a user opens it: by clicking a name.
export const ProfileDrillDown: Story = {
  play: async ({ canvas, canvasElement }) => {
    await waitFor(async () => expect(canvas.getByRole("button", { name: /María González/ })).toBeVisible());

    await userEvent.click(canvas.getByRole("button", { name: /María González/ }));

    // The dialog is portalled to the body, outside the story canvas.
    const modal = within(canvasElement.ownerDocument.body);
    await waitFor(async () => expect(modal.getByRole("dialog", { name: /María González/ })).toBeVisible());
    await expect(modal.getByText("Progress across the suite")).toBeVisible();
  },
};

export const SkillsReport: Story = {
  play: async ({ canvas, canvasElement }) => {
    await waitFor(async () => expect(canvas.getByRole("button", { name: /María González/ })).toBeVisible());

    const row = canvas.getByRole("button", { name: /María González/ }).closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: /skills$/ }));

    const modal = within(canvasElement.ownerDocument.body);
    await waitFor(async () => expect(modal.getByText(/Skills Report ·/)).toBeVisible());
  },
};

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/jobseekers", async () => {
          await delay("infinite");
          return HttpResponse.json({});
        }),
      ],
    },
  },
};

export const Error: Story = {
  parameters: {
    msw: { handlers: [http.get("/api/jobseekers", () => HttpResponse.error())] },
  },
  play: async ({ canvas }) => {
    await waitFor(async () => expect(canvas.getByText("Failed to load jobseekers.")).toBeVisible());
  },
};
