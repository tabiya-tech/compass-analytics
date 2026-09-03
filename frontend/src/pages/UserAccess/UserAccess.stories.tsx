import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { http, HttpResponse, delay } from "msw";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { AuthContext } from "@/auth/AuthContext";
import { AccessProvider } from "@/access/AccessContext";
import { stubRoleRecord, userRoleFor } from "@/_test_utilities/role-grants";
import type { AssignRoleRequest, ManagedUser, RoleRecord } from "@/user/user.types";
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

const implementerRole = stubRoleRecord({ _id: "role-implementer", name: "implementer", label: "Implementer" });
const funderRole = stubRoleRecord({ _id: "role-funder", name: "funder", label: "Funder" });
const storyRoles: RoleRecord[] = [funderRole, implementerRole];

const storyUsers: ManagedUser[] = [
  { user_id: "user-1", email: "isaac.chirwa@example.com", name: "Isaac Chirwa", roles: [] },
  {
    user_id: "user-2",
    email: "naomi.banda@example.com",
    name: "Naomi Banda",
    roles: [userRoleFor(implementerRole._id)],
  },
  {
    user_id: "user-3",
    email: "chanda.phiri@example.com",
    name: "Chanda Phiri",
    roles: [userRoleFor(funderRole._id)],
  },
  {
    user_id: "user-4",
    email: "mutale.banda@example.com",
    name: "Mutale Banda",
    // Provisioned by hand: a role assignment that doesn't resolve to a role this app knows.
    roles: [userRoleFor("role-unknown")],
  },
];

const isAutomated = typeof navigator !== "undefined" && navigator.webdriver;
const MUTATION_DELAY_MS = isAutomated ? 100 : 2000;
const STEP_PAUSE_MS = isAutomated ? 0 : 1200;

/** A beat between steps, so the dialog opening and closing is watchable. */
const pause = () => delay(STEP_PAUSE_MS);

/** Mutated by the role/revoke handlers so a change sticks across the refetch that follows it. */
let users: ManagedUser[] = structuredClone(storyUsers);

const accessHandlers = [
  http.get("/api/roles", () => HttpResponse.json(storyRoles)),
  http.get("/api/users", () => HttpResponse.json(users)),

  http.post("/api/users/:userId/roles", async ({ params, request }) => {
    await delay(MUTATION_DELAY_MS);
    const body = (await request.json()) as AssignRoleRequest;
    const role = storyRoles.find((candidate) => candidate._id === body.role_id);
    const created = userRoleFor(body.role_id, body.institution_id);
    if (role) created.role_name = role.name;
    const user = users.find((candidate) => candidate.user_id === String(params.userId));
    if (user) user.roles = [created];
    return HttpResponse.json(created, { status: 201 });
  }),

  http.delete("/api/users/:userId/roles/:userRoleId", async ({ params }) => {
    await delay(MUTATION_DELAY_MS / 2);
    const user = users.find((candidate) => candidate.user_id === String(params.userId));
    if (user) user.roles = user.roles.filter((userRole) => userRole.role_id !== String(params.userRoleId));
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
  // An open dialog hides the screen from the a11y tree, so let it finish leaving before the story ends.
  await waitFor(async () => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
}

export const Default: Story = {
  play: async ({ canvas }) => {
    await waitFor(async () => expect(canvas.getByText("Isaac Chirwa")).toBeVisible());

    // Each row reports the access the user actually holds.
    await expect(canvas.getByRole("button", { name: /^Grant access to Isaac Chirwa/ })).toBeVisible();
    await expect(canvas.getByRole("button", { name: /^Access granted to Naomi Banda/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(canvas.getByText(/Implementer$/)).toBeVisible();
    await expect(canvas.getByText(/Funder$/)).toBeVisible();
    await expect(canvas.getByText(/No access yet$/)).toBeVisible();
    await expect(canvas.getByText(/Custom permissions$/)).toBeVisible();
  },
};

export const GrantingTheDefaultFunderRole: Story = {
  play: async ({ canvas, canvasElement }) => {
    const grantButtonName = /^Grant access to Isaac Chirwa/;
    await waitFor(async () => expect(canvas.getByRole("button", { name: grantButtonName })).toBeVisible());
    await pause();

    await userEvent.click(canvas.getByRole("button", { name: grantButtonName }));

    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: "Grant access" });
    await waitFor(async () => expect(dialog).toBeVisible());
    // It opens on funder, so the common case is one confirmation.
    await expect(within(dialog).getByRole("combobox", { name: "Role" })).toHaveTextContent("Funder");
    await pause();

    await confirm(canvasElement);

    // The row stays pending for the length of the request, then settles as granted.
    await waitFor(
      async () => expect(canvas.getByRole("button", { name: /^Access granted to Isaac Chirwa/ })).toBeVisible(),
      { timeout: 10_000 }
    );
    await expect(canvas.getAllByText(/Funder$/)).toHaveLength(2);
    await pause();
  },
};

export const GrantingTheImplementerRole: Story = {
  play: async ({ canvas, canvasElement }) => {
    const grantButtonName = /^Grant access to Isaac Chirwa/;
    await waitFor(async () => expect(canvas.getByRole("button", { name: grantButtonName })).toBeVisible());
    await pause();

    await userEvent.click(canvas.getByRole("button", { name: grantButtonName }));

    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: "Grant access" });
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Role" }));
    await userEvent.click(await body.findByRole("option", { name: "Implementer" }));
    await pause();

    // An implementer runs Compass at one institution, so picking one is offered — though optional.
    const institution = await within(dialog).findByRole("combobox", { name: "Institution" });
    await waitFor(async () => expect(institution).toBeEnabled());
    await userEvent.click(institution);
    await userEvent.click(await body.findByRole("option", { name: "Lusaka Skills Hub" }));
    await pause();

    await confirm(canvasElement);

    // The role that was picked is the one the row reports once the change lands.
    await waitFor(async () => expect(canvas.getAllByText(/Implementer$/)).toHaveLength(2), { timeout: 10_000 });
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
    const dialog = await body.findByRole("dialog", { name: "Remove access" });
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
    await waitFor(async () => expect(canvas.getByText("There are no users to give access to yet.")).toBeVisible());
  },
};

export const Error: Story = {
  parameters: {
    msw: { handlers: [http.get("/api/users", () => new HttpResponse(null, { status: 500 })), ...handlers] },
  },
  play: async ({ canvas }) => {
    await waitFor(async () => expect(canvas.getByText("Failed to load user access.")).toBeVisible());
    await expect(canvas.getByRole("button", { name: "Retry" })).toBeVisible();
  },
};
