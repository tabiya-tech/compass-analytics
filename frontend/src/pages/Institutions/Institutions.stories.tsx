import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { http, HttpResponse, delay } from "msw";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { AuthContext } from "@/auth/AuthContext";
import { AccessProvider, MODULE_IDS } from "@/access/AccessContext";
import { Institutions } from "./Institutions";

/** Storybook gives the story router, i18n and MSW — but not auth, so stub a signed-in user here. */
function InstitutionsHarness({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AuthContext.Provider value={{ user: null, loading: false, getIdToken: async () => "storybook-token" }}>
      {children}
    </AuthContext.Provider>
  );
}

const meta = {
  component: Institutions,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <InstitutionsHarness>
        <AccessProvider>
          <Story />
        </AccessProvider>
      </InstitutionsHarness>
    ),
  ],
} satisfies Meta<typeof Institutions>;

export default meta;
type Story = StoryObj<typeof meta>;

// The shared MSW handlers serve the mocked 30-institution portfolio.
export const AllModulesDeployed: Story = {
  play: async ({ canvas }) => {
    await waitFor(async () => expect(canvas.getByText("Mazabuka Livelihoods Trust")).toBeVisible());
    await expect(canvas.getByText("Jobseekers reached across the portfolio")).toBeVisible();
    await expect(canvas.getByRole("columnheader", { name: /BYP % started/ })).toBeVisible();
  },
};

// A deployment running Build Your Profile and Job readiness only.
export const TwoModulesDeployed: Story = {
  decorators: [
    (Story) => (
      <InstitutionsHarness>
        <AccessProvider access={{ activeModules: [MODULE_IDS.BUILD_YOUR_PROFILE, MODULE_IDS.JOB_READINESS] }}>
          <Story />
        </AccessProvider>
      </InstitutionsHarness>
    ),
  ],
  play: async ({ canvas }) => {
    await waitFor(async () => expect(canvas.getByRole("columnheader", { name: /BYP % started/ })).toBeVisible());
    await expect(canvas.queryByRole("columnheader", { name: /Career Explorer/ })).not.toBeInTheDocument();
  },
};

export const Searching: Story = {
  play: async ({ canvas }) => {
    await waitFor(async () => expect(canvas.getByText("Mazabuka Livelihoods Trust")).toBeVisible());

    await userEvent.type(canvas.getByRole("searchbox", { name: "Search institutions by name" }), "mazabuka");

    await waitFor(async () => expect(canvas.getByText("1 institution")).toBeVisible());
  },
};

export const NoMatches: Story = {
  play: async ({ canvas }) => {
    await waitFor(async () => expect(canvas.getByText("Mazabuka Livelihoods Trust")).toBeVisible());

    await userEvent.type(canvas.getByRole("searchbox", { name: "Search institutions by name" }), "no such institution");

    await waitFor(async () =>
      expect(canvas.getByRole("status")).toHaveTextContent("No institutions match your search or filters.")
    );
  },
};

// The drill-down, opened the way a user opens it: by clicking a row.
export const InstitutionDrillDown: Story = {
  play: async ({ canvas, canvasElement }) => {
    await waitFor(async () => expect(canvas.getByText("Chipata Vocational Centre")).toBeVisible());

    await userEvent.click(canvas.getByRole("button", { name: "Chipata Vocational Centre" }));

    // The dialog is portalled to the body, outside the story canvas.
    const modal = within(canvasElement.ownerDocument.body);
    await waitFor(async () => expect(modal.getByRole("dialog", { name: /Chipata Vocational Centre/ })).toBeVisible());
    await expect(modal.getByText("Progress across the suite")).toBeVisible();
  },
};

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/institutions", async () => {
          await delay("infinite");
          return HttpResponse.json({});
        }),
      ],
    },
  },
};

export const Error: Story = {
  parameters: {
    msw: { handlers: [http.get("/api/institutions", () => HttpResponse.error())] },
  },
  play: async ({ canvas }) => {
    await waitFor(async () => expect(canvas.getByText("Failed to load institutions.")).toBeVisible());
  },
};
