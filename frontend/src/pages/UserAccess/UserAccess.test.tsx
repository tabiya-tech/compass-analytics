import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@/_test_utilities/test-utils";
import { server } from "@/mocks/server";
import { Action, Subject } from "@/access/AccessContext";
import { Role } from "@/access/roles";
import { grantsForRole } from "@/_test_utilities/role-grants";
import { ALL_INSTITUTIONS, type ManagedUser, type RoleRequest } from "@/user/user.types";
import { UserAccess, DATA_TEST_ID } from "./UserAccess";
import { DATA_TEST_ID as ROW_TEST_ID } from "./components/AccessRow/AccessRow";
import { DATA_TEST_ID as DIALOG_TEST_ID } from "./components/ConfirmAccessDialog/ConfirmAccessDialog";

/** Isaac holds no access at all; Naomi already holds the implementer role. */
const givenUsers: ManagedUser[] = [
  { user_id: "user-1", email: "isaac.chirwa@example.com", name: "Isaac Chirwa", grants: [] },
  {
    user_id: "user-2",
    email: "naomi.banda@example.com",
    name: "Naomi Banda",
    grants: grantsForRole(Role.Implementer),
  },
];

/** Serves GET /api/users from a mutable list, so a grant made in a test is visible on reload. */
function givenUsersEndpoint(users: ManagedUser[] = givenUsers) {
  const state = structuredClone(users);
  server.use(http.get("/api/users", () => HttpResponse.json(state)));
  return state;
}

/** Assigns the role server-side, so the re-read reflects it. */
function givenRoleEndpoint(state: ManagedUser[], onCall?: (url: URL, body: RoleRequest) => void) {
  server.use(
    http.post("/api/users/:userId/roles", async ({ params, request }) => {
      const body = (await request.json()) as RoleRequest;
      onCall?.(new URL(request.url), body);
      const created = grantsForRole(body.role, body.institution_id);
      const user = state.find((candidate) => candidate.user_id === String(params.userId));
      if (user) user.grants = created;
      return HttpResponse.json(created, { status: 201 });
    })
  );
}

/** Deletes grants one at a time, as the API does. Records the paths called; `refuseAfter` refuses one. */
function givenGrantDeleteEndpoint(state: ManagedUser[], refuseAfter?: (deletedSoFar: number) => boolean) {
  const called: string[] = [];
  server.use(
    http.delete("/api/users/:userId/grants/:grantId", ({ params, request }) => {
      called.push(new URL(request.url).pathname);
      if (refuseAfter?.(called.length)) return new HttpResponse(null, { status: 403 });
      const user = state.find((candidate) => candidate.user_id === String(params.userId));
      if (user) user.grants = user.grants.filter((grant) => grant.grant_id !== String(params.grantId));
      return new HttpResponse(null, { status: 204 });
    })
  );
  return called;
}

async function renderAndWaitForRows() {
  render(<UserAccess />);
  await waitFor(() => expect(screen.getByTestId(DATA_TEST_ID.LIST)).toBeInTheDocument());
  return screen.getAllByTestId(ROW_TEST_ID.CONTAINER);
}

/** Opens a row's confirmation and picks a role in it. */
async function pickRole(row: HTMLElement, roleLabel: string) {
  await userEvent.click(within(row).getByTestId(ROW_TEST_ID.TOGGLE));
  await screen.findByTestId(DIALOG_TEST_ID.CONTAINER);
  await userEvent.click(screen.getByTestId(DIALOG_TEST_ID.ROLE_SELECT));
  await userEvent.click(await screen.findByRole("option", { name: roleLabel }));
}

describe("UserAccess", () => {
  it("should show the screen heading while the user list is still being fetched", () => {
    // GIVEN the users endpoint has not answered yet
    givenUsersEndpoint();

    // WHEN the screen is opened
    render(<UserAccess />);

    // THEN the heading is already there, so the screen does not appear blank
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveTextContent("User access");
    expect(screen.queryByTestId(DATA_TEST_ID.LIST)).not.toBeInTheDocument();
  });

  it("should list every managed user with their email and the role they hold", async () => {
    // GIVEN two provisioned users
    givenUsersEndpoint();

    // WHEN the screen has loaded
    const rows = await renderAndWaitForRows();

    // THEN each user is listed, with the access they actually hold
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByTestId(ROW_TEST_ID.USER)).toHaveTextContent("Isaac Chirwa");
    expect(within(rows[0]).getByTestId(ROW_TEST_ID.DETAIL)).toHaveTextContent(
      "isaac.chirwa@example.com · No access yet"
    );
    expect(within(rows[1]).getByTestId(ROW_TEST_ID.DETAIL)).toHaveTextContent("naomi.banda@example.com · Implementer");
  });

  it("should scroll a list too long for the box inside it, rather than down the page", async () => {
    // GIVEN more users than fit the screen
    givenUsersEndpoint(
      Array.from({ length: 30 }, (_, i) => ({
        user_id: `user-${i}`,
        email: `pm${i}@example.com`,
        name: `PM ${i}`,
        grants: [],
      }))
    );

    // WHEN the screen has loaded
    await renderAndWaitForRows();

    // THEN the list itself scrolls, keeping the heading in view
    expect(screen.getByTestId(DATA_TEST_ID.LIST)).toHaveClass("overflow-y-auto");
  });

  it("should reflect the access each user already holds in their toggle", async () => {
    // GIVEN one user with a role and one with none
    givenUsersEndpoint();

    // WHEN the screen has loaded
    const rows = await renderAndWaitForRows();

    // THEN the toggle reads from the grants each user actually holds
    expect(within(rows[0]).getByTestId(ROW_TEST_ID.TOGGLE)).toHaveAttribute("aria-pressed", "false");
    expect(within(rows[1]).getByTestId(ROW_TEST_ID.TOGGLE)).toHaveAttribute("aria-pressed", "true");
  });

  it("should ask the funder to pick a role before anything is granted", async () => {
    // GIVEN a user with no access
    const state = givenUsersEndpoint();
    let granted = false;
    givenRoleEndpoint(state, () => {
      granted = true;
    });
    const rows = await renderAndWaitForRows();

    // WHEN the funder starts granting their access
    await userEvent.click(within(rows[0]).getByTestId(ROW_TEST_ID.TOGGLE));

    // THEN a role is asked for first, and nothing is written yet
    expect(await screen.findByTestId(DIALOG_TEST_ID.CONTAINER)).toBeInTheDocument();
    expect(screen.getByTestId(DIALOG_TEST_ID.DESCRIPTION)).toHaveTextContent("Isaac Chirwa");
    expect(screen.getByTestId(DIALOG_TEST_ID.ROLE_SELECT)).toBeInTheDocument();
    expect(granted).toBe(false);
  });

  it("should grant nothing when the funder cancels the confirmation", async () => {
    // GIVEN a confirmation is open
    const state = givenUsersEndpoint();
    let granted = false;
    givenRoleEndpoint(state, () => {
      granted = true;
    });
    const rows = await renderAndWaitForRows();
    await userEvent.click(within(rows[0]).getByTestId(ROW_TEST_ID.TOGGLE));
    await screen.findByTestId(DIALOG_TEST_ID.CONTAINER);

    // WHEN the funder cancels
    await userEvent.click(screen.getByTestId(DIALOG_TEST_ID.CANCEL));

    // THEN nothing is written, and the row is left as it was
    await waitFor(() => expect(screen.queryByTestId(DIALOG_TEST_ID.CONTAINER)).not.toBeInTheDocument());
    expect(granted).toBe(false);
    expect(within(rows[0]).getByTestId(ROW_TEST_ID.TOGGLE)).toHaveAttribute("aria-pressed", "false");
  });

  it("should post the default funder role across every institution when a grant is confirmed", async () => {
    // GIVEN a user with no access
    const state = givenUsersEndpoint();
    let actualUrl: URL | undefined;
    let actualBody: RoleRequest | undefined;
    givenRoleEndpoint(state, (url, body) => {
      actualUrl = url;
      actualBody = body;
    });
    const rows = await renderAndWaitForRows();

    // WHEN the funder grants access without touching the role dropdown
    await userEvent.click(within(rows[0]).getByTestId(ROW_TEST_ID.TOGGLE));
    await userEvent.click(await screen.findByTestId(DIALOG_TEST_ID.CONFIRM));

    // THEN the role the dialog opened on is posted, scoped to every institution
    await waitFor(() => expect(actualBody).toBeDefined());
    expect(actualUrl?.pathname).toBe("/api/users/user-1/roles");
    expect(actualBody).toEqual({ role: Role.Funder, institution_id: ALL_INSTITUTIONS });
  });

  it("should post the implementer role when that is the one picked", async () => {
    // GIVEN a user with no access
    const state = givenUsersEndpoint();
    let actualBody: RoleRequest | undefined;
    givenRoleEndpoint(state, (_url, body) => {
      actualBody = body;
    });
    const rows = await renderAndWaitForRows();

    // WHEN the funder picks the implementer role and confirms
    await pickRole(rows[0], "Implementer");
    await userEvent.click(screen.getByTestId(DIALOG_TEST_ID.CONFIRM));

    // THEN that is the role written, not the one the dialog opened on
    await waitFor(() => expect(actualBody).toBeDefined());
    expect(actualBody).toEqual({ role: Role.Implementer, institution_id: ALL_INSTITUTIONS });
  });

  it("should offer to remove the whole role from a user who already holds one", async () => {
    // GIVEN a user who already holds the funder role
    givenUsersEndpoint([
      { user_id: "user-3", email: "chanda@example.com", name: "Chanda Phiri", grants: grantsForRole(Role.Funder) },
    ]);
    const rows = await renderAndWaitForRows();

    // WHEN the funder opens their row
    await userEvent.click(within(rows[0]).getByTestId(ROW_TEST_ID.TOGGLE));

    // THEN the removal is offered — their whole role goes, so there is no role to pick
    expect(await screen.findByTestId(DIALOG_TEST_ID.TITLE)).toHaveTextContent("Remove access");
    expect(screen.queryByTestId(DIALOG_TEST_ID.ROLE_SELECT)).not.toBeInTheDocument();
  });

  it("should show the granted role once it lands, without a reload", async () => {
    // GIVEN a user with no access
    const state = givenUsersEndpoint();
    givenRoleEndpoint(state);
    const rows = await renderAndWaitForRows();

    // WHEN the funder grants them the implementer role
    await pickRole(rows[0], "Implementer");
    await userEvent.click(screen.getByTestId(DIALOG_TEST_ID.CONFIRM));

    // THEN the row re-reads from the server and names the role they now hold
    await waitFor(() => expect(screen.getAllByTestId(ROW_TEST_ID.TOGGLE)[0]).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getAllByTestId(ROW_TEST_ID.DETAIL)[0]).toHaveTextContent("Implementer");
  });

  it("should delete every grant a user holds when their access is toggled off", async () => {
    // GIVEN a user who already holds a whole role
    const state = givenUsersEndpoint();
    const deleted = givenGrantDeleteEndpoint(state);
    const rows = await renderAndWaitForRows();

    // WHEN the funder removes their access and confirms
    await userEvent.click(within(rows[1]).getByTestId(ROW_TEST_ID.TOGGLE));
    expect(await screen.findByTestId(DIALOG_TEST_ID.TITLE)).toHaveTextContent("Remove access");
    await userEvent.click(screen.getByTestId(DIALOG_TEST_ID.CONFIRM));

    // THEN every grant the role gave them is deleted, not just the dashboard one
    await waitFor(() => expect(deleted).toHaveLength(grantsForRole(Role.Implementer).length));
    expect(deleted).toEqual(
      grantsForRole(Role.Implementer).map((grant) => `/api/users/user-2/grants/${grant.grant_id}`)
    );
    // AND the row now offers the grant again, with no role left to name
    await waitFor(() => expect(screen.getAllByTestId(ROW_TEST_ID.TOGGLE)[1]).toHaveAttribute("aria-pressed", "false"));
    expect(screen.getAllByTestId(ROW_TEST_ID.DETAIL)[1]).toHaveTextContent("No access yet");
  });

  it("should show the access that is left when a removal fails part-way through", async () => {
    // GIVEN a removal whose second delete is refused
    const state = givenUsersEndpoint();
    givenGrantDeleteEndpoint(state, (deletedSoFar) => deletedSoFar > 1);
    const rows = await renderAndWaitForRows();

    // WHEN the funder removes their access and confirms
    await userEvent.click(within(rows[1]).getByTestId(ROW_TEST_ID.TOGGLE));
    await userEvent.click(await screen.findByTestId(DIALOG_TEST_ID.CONFIRM));

    // THEN the failure is reported, and the row reports what the user is actually left holding
    const failure = await screen.findByTestId(DATA_TEST_ID.FAILURE);
    expect(failure).toHaveTextContent("Could not remove Naomi Banda's access. Please try again.");
    await waitFor(() => expect(screen.getAllByTestId(ROW_TEST_ID.DETAIL)[1]).toHaveTextContent("Custom permissions"));

    // Snackbars outlive the render that raised them, so dismiss it rather than leaving it up.
    await userEvent.click(within(failure).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByTestId(DATA_TEST_ID.FAILURE)).not.toBeInTheDocument());
  });

  it("should report access without a role for a user whose grants match none", async () => {
    // GIVEN a user provisioned by hand, holding part of a role only
    givenUsersEndpoint([
      {
        user_id: "user-4",
        email: "mutale@example.com",
        name: "Mutale Banda",
        grants: [{ grant_id: "g1", subject: Subject.Dashboard, action: Action.View, institution_id: ALL_INSTITUTIONS }],
      },
    ]);

    // WHEN the screen has loaded
    const rows = await renderAndWaitForRows();

    // THEN no role is claimed for them, but the access they hold is not hidden either
    expect(within(rows[0]).getByTestId(ROW_TEST_ID.DETAIL)).toHaveTextContent("Custom permissions");
    expect(within(rows[0]).getByTestId(ROW_TEST_ID.TOGGLE)).toHaveAttribute("aria-pressed", "true");
  });

  it("should tell the funder when the API refuses the change", async () => {
    // GIVEN the caller may not grant access
    givenUsersEndpoint();
    server.use(http.post("/api/users/:userId/roles", () => new HttpResponse(null, { status: 403 })));
    const rows = await renderAndWaitForRows();

    // WHEN the funder grants access and confirms
    await userEvent.click(within(rows[0]).getByTestId(ROW_TEST_ID.TOGGLE));
    await userEvent.click(await screen.findByTestId(DIALOG_TEST_ID.CONFIRM));

    // THEN the refusal is announced in a snackbar, rather than the row quietly snapping back
    const failure = await screen.findByTestId(DATA_TEST_ID.FAILURE);
    expect(failure).toHaveTextContent("Could not grant access to Isaac Chirwa. Please try again.");

    // AND the funder can dismiss it
    await userEvent.click(within(failure).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByTestId(DATA_TEST_ID.FAILURE)).not.toBeInTheDocument());
  });

  it("should tell the funder when a removal is refused", async () => {
    // GIVEN the removal is refused
    givenUsersEndpoint();
    server.use(http.delete("/api/users/:userId/grants/:grantId", () => new HttpResponse(null, { status: 403 })));
    const rows = await renderAndWaitForRows();

    // WHEN the funder removes access and confirms
    await userEvent.click(within(rows[1]).getByTestId(ROW_TEST_ID.TOGGLE));
    await userEvent.click(await screen.findByTestId(DIALOG_TEST_ID.CONFIRM));

    // THEN the refusal names the user it concerns, and the row keeps the access they still hold
    const failure = await screen.findByTestId(DATA_TEST_ID.FAILURE);
    expect(failure).toHaveTextContent("Could not remove Naomi Banda's access. Please try again.");
    expect(within(rows[1]).getByTestId(ROW_TEST_ID.TOGGLE)).toHaveAttribute("aria-pressed", "true");

    // Snackbars outlive the render that raised them, so dismiss it.
    await userEvent.click(within(failure).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByTestId(DATA_TEST_ID.FAILURE)).not.toBeInTheDocument());
  });

  it("should keep the list when the reload after a saved change fails", async () => {
    // GIVEN a grant that lands, and a reload that then fails
    const state = structuredClone(givenUsers);
    let reads = 0;
    server.use(
      http.get("/api/users", () => {
        reads += 1;
        return reads > 1 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(state);
      }),
      http.post("/api/users/:userId/roles", () => HttpResponse.json(grantsForRole(Role.Funder), { status: 201 }))
    );
    const rows = await renderAndWaitForRows();

    // WHEN the funder grants access and confirms
    await userEvent.click(within(rows[0]).getByTestId(ROW_TEST_ID.TOGGLE));
    await userEvent.click(await screen.findByTestId(DIALOG_TEST_ID.CONFIRM));

    // THEN the saved change is not reported as a failure to save, and the list is not thrown away
    expect(await screen.findByTestId(DATA_TEST_ID.FAILURE)).toHaveTextContent(
      "The change was saved, but the list could not be refreshed."
    );
    expect(screen.getByTestId(DATA_TEST_ID.LIST)).toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.ERROR)).not.toBeInTheDocument();
  });

  it("should leave a row as it was when the API refuses the change", async () => {
    // GIVEN the caller may not grant access
    givenUsersEndpoint();
    server.use(http.post("/api/users/:userId/roles", () => new HttpResponse(null, { status: 403 })));
    const rows = await renderAndWaitForRows();

    // WHEN the funder grants access and confirms
    await userEvent.click(within(rows[0]).getByTestId(ROW_TEST_ID.TOGGLE));
    await userEvent.click(await screen.findByTestId(DIALOG_TEST_ID.CONFIRM));

    // THEN the row stays as it was, rather than claiming an access that was refused
    await waitFor(() => expect(within(rows[0]).getByTestId(ROW_TEST_ID.TOGGLE)).toBeEnabled());
    expect(within(rows[0]).getByTestId(ROW_TEST_ID.TOGGLE)).toHaveAttribute("aria-pressed", "false");
  });

  it("should offer a retry when the user list cannot be loaded", async () => {
    // GIVEN the users endpoint fails
    server.use(http.get("/api/users", () => new HttpResponse(null, { status: 500 })));

    // WHEN the screen is opened
    render(<UserAccess />);

    // THEN the failure is shown, with a way to try again
    const error = await screen.findByTestId(DATA_TEST_ID.ERROR);
    expect(error).toHaveTextContent("Failed to load user access.");
    expect(within(error).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("should load the list on a retry, after the first attempt failed", async () => {
    // GIVEN the first attempt failed
    let attempts = 0;
    server.use(
      http.get("/api/users", () => {
        attempts += 1;
        return attempts === 1 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(givenUsers);
      })
    );
    render(<UserAccess />);
    const error = await screen.findByTestId(DATA_TEST_ID.ERROR);

    // WHEN the funder retries
    await userEvent.click(within(error).getByRole("button", { name: "Retry" }));

    // THEN the list loads
    await waitFor(() => expect(screen.getByTestId(DATA_TEST_ID.LIST)).toBeInTheDocument());
    expect(screen.getAllByTestId(ROW_TEST_ID.CONTAINER)).toHaveLength(2);
  });

  it("should say so when there are no users to give access to", async () => {
    // GIVEN no users are provisioned
    givenUsersEndpoint([]);

    // WHEN the screen has loaded
    render(<UserAccess />);

    // THEN it says so, rather than showing an empty box
    expect(await screen.findByText("There are no users to give access to yet.")).toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.LIST)).not.toBeInTheDocument();
  });
});
