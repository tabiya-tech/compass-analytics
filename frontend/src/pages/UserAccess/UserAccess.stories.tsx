import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { http, HttpResponse, delay } from "msw";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { AuthContext } from "@/auth/AuthContext";
import { AccessProvider, Action, Subject } from "@/access/AccessContext";
import type { GrantRequest, GrantView, ManagedUser } from "@/user/user.types";
import { handlers } from "@/mocks/handlers";
import { UserAccess } from "./UserAccess";

/** Storybook gives the story router, i18n and MSW — but not auth, so stub a signed-in user here. */
function UserAccessHarness({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AuthContext.Provider value={{ user: null, loading: false, getIdToken: async () => "storybook-token" }}>
      {children}
    </AuthContext.Provider>
  );
}

const dashboardGrant: GrantView = {
  grant_id: "grant-dashboard-inst-2",
  subject: Subject.Dashboard,
  action: Action.View,
  institution_id: "inst-2",
};

const storyUsers: ManagedUser[] = [
  {
    user_id: "user-1",
    email: "isaac.chirwa@example.com",
    name: "Isaac Chirwa",
    grants: [{ grant_id: "grant-1", subject: Subject.Jobseekers, action: Action.View, institution_id: "inst-1" }],
  },
  {
    user_id: "user-2",
    email: "naomi.banda@example.com",
    name: "Naomi Banda",
    grants: [
      { grant_id: "grant-2", subject: Subject.Jobseekers, action: Action.View, institution_id: "inst-2" },
      dashboardGrant,
    ],
  },
  { user_id: "user-9", email: "new.joiner@example.com", name: "New Joiner", grants: [] },
];

const isAutomated = typeof navigator !== "undefined" && navigator.webdriver;
const MUTATION_DELAY_MS = isAutomated ? 100 : 2000;
const STEP_PAUSE_MS = isAutomated ? 0 : 1200;

/** A beat between steps, so the dialog opening and closing is watchable. */
const pause = () => delay(STEP_PAUSE_MS);

/** Mutated by the grant/revoke handlers so a change sticks across the refetch that follows it. */
let users: ManagedUser[] = structuredClone(storyUsers);

const accessHandlers = [
  http.get("/api/users", () => HttpResponse.json(users)),

  http.post("/api/users/:userId/grants", async ({ params, request }) => {
    await delay(MUTATION_DELAY_MS);
    const body = (await request.json()) as GrantRequest;
    const created: GrantView = { grant_id: `grant-${params.userId}-${body.subject}-${body.action}`, ...body };
    users.find((user) => user.user_id === String(params.userId))?.grants.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  http.delete("/api/users/:userId/grants/:grantId", async ({ params }) => {
    await delay(MUTATION_DELAY_MS);
    const user = users.find((candidate) => candidate.user_id === String(params.userId));
    if (user) user.grants = user.grants.filter((grant) => grant.grant_id !== String(params.grantId));
    return new HttpResponse(null, { status: 204 });
  }),
];

const meta = {
  component: UserAccess,
  tags: ["autodocs"],
  beforeEach: () => {
    users = structuredClone(storyUsers);
  },
  parameters: { layout: "fullscreen", msw: { handlers: [...accessHandlers, ...handlers] } },
  decorators: [
    (Story) => (
      <UserAccessHarness>
        <AccessProvider>
          <Story />
        </AccessProvider>
      </UserAccessHarness>
    ),
  ],
} satisfies Meta<typeof UserAccess>;

export default meta;
type Story = StoryObj<typeof meta>;

// The confirmation dialog is portalled to the body, outside the story canvas.
async function confirm(canvasElement: HTMLElement): Promise<void> {
  const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(await body.findByRole("button", { name: /^(Grant|Remove) access$/ }));
}

export const Default: Story = {
  play: async ({ canvas }) => {
    await waitFor(async () => expect(canvas.getByText("Isaac Chirwa")).toBeVisible());

    // Each user's toggle reflects the dashboard grant they actually hold.
    await expect(canvas.getByRole("button", { name: /^Grant access to Isaac Chirwa/ })).toBeVisible();
    await expect(canvas.getByRole("button", { name: /^Access granted to Naomi Banda/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    // A user with no grants has no institution to scope a new one to.
    await expect(canvas.getByRole("button", { name: /^Grant access to New Joiner/ })).toBeDisabled();
  },
};

export const AccessGranted: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/users", () =>
          HttpResponse.json([
            {
              user_id: "user-1",
              email: "isaac.chirwa@example.com",
              name: "Isaac Chirwa",
              grants: [
                { grant_id: "grant-1", subject: Subject.Jobseekers, action: Action.View, institution_id: "inst-1" },
                { grant_id: "grant-2", subject: Subject.Dashboard, action: Action.View, institution_id: "inst-1" },
              ],
            } satisfies ManagedUser,
          ])
        ),
        ...handlers,
      ],
    },
  },
  play: async ({ canvas }) => {
    await waitFor(async () =>
      expect(canvas.getByRole("button", { name: /^Access granted to Isaac Chirwa/ })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    );
  },
};

export const GrantingAccess: Story = {
  play: async ({ canvas, canvasElement }) => {
    const grantButtonName = /^Grant access to Isaac Chirwa/;
    await waitFor(async () => expect(canvas.getByRole("button", { name: grantButtonName })).toBeVisible());
    await pause();

    await userEvent.click(canvas.getByRole("button", { name: grantButtonName }));

    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: "Grant dashboard access?" });
    await waitFor(async () => expect(dialog).toBeVisible());
    await pause();

    await confirm(canvasElement);

    // The row stays pending for the length of the request, then settles as granted.
    await waitFor(
      async () => expect(canvas.getByRole("button", { name: /^Access granted to Isaac Chirwa/ })).toBeVisible(),
      { timeout: 10_000 }
    );
    await pause();
  },
};

export const RemovingAccess: Story = {
  play: async ({ canvas, canvasElement }) => {
    const removeButtonName = /^Access granted to Naomi Banda/;
    await waitFor(async () => expect(canvas.getByRole("button", { name: removeButtonName })).toBeVisible());
    await pause();

    await userEvent.click(canvas.getByRole("button", { name: removeButtonName }));

    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: "Remove dashboard access?" });
    await waitFor(async () => expect(dialog).toBeVisible());
    await pause();

    await confirm(canvasElement);

    await waitFor(
      async () => expect(canvas.getByRole("button", { name: /^Grant access to Naomi Banda/ })).toBeVisible(),
      { timeout: 10_000 }
    );
    await pause();
  },
};

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/users", async () => {
          await delay("infinite");
          return HttpResponse.json([]);
        }),
        ...handlers,
      ],
    },
  },
};

export const Empty: Story = {
  parameters: { msw: { handlers: [http.get("/api/users", () => HttpResponse.json([])), ...handlers] } },
  play: async ({ canvas }) => {
    await waitFor(async () => expect(canvas.getByText("There are no users to grant access to yet.")).toBeVisible());
  },
};

export const Error: Story = {
  parameters: {
    msw: { handlers: [http.get("/api/users", () => new HttpResponse(null, { status: 500 })), ...handlers] },
  },
  play: async ({ canvas }) => {
    await waitFor(async () => expect(canvas.getByText("Failed to load dashboard access.")).toBeVisible());
    await expect(canvas.getByRole("button", { name: "Retry" })).toBeVisible();
  },
};
