import type { Meta, StoryObj } from "@storybook/react-vite";
import { http, HttpResponse, delay } from "msw";
import type { ReactNode } from "react";
import { AuthContext } from "@/auth/AuthContext";
import { FiltersProvider } from "@/filters/FiltersContext";
import type { ReachResponse } from "@/analytics/analytics.types";
import { Overview } from "./Overview";

const stubReach: ReachResponse = {
  summary: {
    total_users: 12_450,
    active_users_30d: 3_210,
    total_logins: 48_900,
    avg_logins_per_user: 3.93,
    avg_session_minutes: 22,
  },
  series: [],
};

/**
 * Overview reads auth (for the bearer token) and filters (for the query params).
 * Storybook's preview provides router + i18n + MSW, but not these two — so the
 * story supplies a signed-in AuthContext stub and a FiltersProvider itself.
 */
function OverviewHarness({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AuthContext.Provider value={{ user: null, loading: false, getIdToken: async () => "storybook-token" }}>
      <FiltersProvider>{children}</FiltersProvider>
    </AuthContext.Provider>
  );
}

const meta = {
  component: Overview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OverviewHarness>
        <Story />
      </OverviewHarness>
    ),
  ],
} satisfies Meta<typeof Overview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  parameters: {
    msw: { handlers: [http.get("/api/reach", () => HttpResponse.json(stubReach))] },
  },
};

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/reach", async () => {
          await delay("infinite");
          return HttpResponse.json(stubReach);
        }),
      ],
    },
  },
};

export const Error: Story = {
  parameters: {
    msw: { handlers: [http.get("/api/reach", () => HttpResponse.error())] },
  },
};
