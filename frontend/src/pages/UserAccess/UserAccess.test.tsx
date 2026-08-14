import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@/_test_utilities/test-utils";
import { server } from "@/mocks/server";
import { Action, Subject } from "@/access/AccessContext";
import type { GrantRequest, GrantView, ManagedUser } from "@/user/user.types";
import { UserAccess, DATA_TEST_ID } from "./UserAccess";
import { DATA_TEST_ID as ROW_TEST_ID } from "./components/AccessRow/AccessRow";
import { DATA_TEST_ID as DIALOG_TEST_ID } from "./components/ConfirmAccessDialog/ConfirmAccessDialog";

const jobseekersGrant = (institutionId: string): GrantView => ({
  grant_id: `grant-jobseekers-${institutionId}`,
  subject: Subject.Jobseekers,
  action: Action.View,
  institution_id: institutionId,
});

const dashboardGrant: GrantView = {
  grant_id: "grant-dashboard-inst-2",
  subject: Subject.Dashboard,
  action: Action.View,
  institution_id: "inst-2",
};

/** Isaac holds no dashboard access; Naomi does. Both are scoped to an institution. */
const givenUsers: ManagedUser[] = [
  {
    user_id: "user-1",
    email: "isaac.chirwa@example.com",
    name: "Isaac Chirwa",
    grants: [jobseekersGrant("inst-1")],
  },
  {
    user_id: "user-2",
    email: "naomi.banda@example.com",
    name: "Naomi Banda",
    grants: [jobseekersGrant("inst-2"), dashboardGrant],
  },
];

/** Serves GET /api/users from a mutable list, so a grant made in a test is visible on reload. */
function givenUsersEndpoint(users: ManagedUser[] = givenUsers) {
  const state = structuredClone(users);
  server.use(http.get("/api/users", () => HttpResponse.json(state)));
  return state;
}

async function renderAndWaitForRows() {
  render(<UserAccess />);
  await waitFor(() => expect(screen.getByTestId(DATA_TEST_ID.LIST)).toBeInTheDocument());
  return screen.getAllByTestId(ROW_TEST_ID.CONTAINER);
}

describe("UserAccess", () => {
  it("should show the screen heading while the user list is still being fetched", () => {
    // GIVEN the users endpoint has not answered yet
    givenUsersEndpoint();

    // WHEN the screen is opened
    render(<UserAccess />);

    // THEN the heading is already there, so the screen does not appear blank
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveTextContent("Dashboard access");
    expect(screen.queryByTestId(DATA_TEST_ID.LIST)).not.toBeInTheDocument();
  });

  it("should list every managed user with their email and institution", async () => {
    // GIVEN two provisioned users
    givenUsersEndpoint();

    // WHEN the screen has loaded
    const rows = await renderAndWaitForRows();

    // THEN each user is listed, with the institution their access is scoped to
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByTestId(ROW_TEST_ID.USER)).toHaveTextContent("Isaac Chirwa");
    expect(within(rows[0]).getByTestId(ROW_TEST_ID.DETAIL)).toHaveTextContent("isaac.chirwa@example.com · inst-1");
    expect(within(rows[1]).getByTestId(ROW_TEST_ID.USER)).toHaveTextContent("Naomi Banda");
  });

  it("should scroll a list too long for the box inside it, rather than down the page", async () => {
    // GIVEN more users than fit the screen
    givenUsersEndpoint(
      Array.from({ length: 30 }, (_, i) => ({
        user_id: `user-${i}`,
        email: `pm${i}@example.com`,
        name: `PM ${i}`,
        grants: [jobseekersGrant(`inst-${i}`)],
      }))
    );

    // WHEN the screen has loaded
    await renderAndWaitForRows();

    // THEN the list itself scrolls, keeping the heading in view
    expect(screen.getByTestId(DATA_TEST_ID.LIST)).toHaveClass("overflow-y-auto");
  });

  it("should reflect each user's existing dashboard grant in their toggle", async () => {
    // GIVEN one user with dashboard access and one without
    givenUsersEndpoint();

    // WHEN the screen has loaded
    const rows = await renderAndWaitForRows();

    // THEN the toggle reads from the grant each user actually holds
    expect(within(rows[0]).getByTestId(ROW_TEST_ID.TOGGLE)).toHaveAttribute("aria-pressed", "false");
    expect(within(rows[1]).getByTestId(ROW_TEST_ID.TOGGLE)).toHaveAttribute("aria-pressed", "true");
  });

  it("should ask the funder to confirm before anything is granted", async () => {
    // GIVEN a user without dashboard access
    givenUsersEndpoint();
    let granted = false;
    server.use(
      http.post("/api/users/:userId/grants", () => {
        granted = true;
        return HttpResponse.json(dashboardGrant, { status: 201 });
      })
    );
    const rows = await renderAndWaitForRows();

    // WHEN the funder toggles their access on
    await userEvent.click(within(rows[0]).getByTestId(ROW_TEST_ID.TOGGLE));

    // THEN a confirmation is asked for first, and nothing is written yet
    expect(await screen.findByTestId(DIALOG_TEST_ID.CONTAINER)).toBeInTheDocument();
    expect(screen.getByTestId(DIALOG_TEST_ID.DESCRIPTION)).toHaveTextContent("Isaac Chirwa");
    expect(granted).toBe(false);
  });

  it("should grant nothing when the funder cancels the confirmation", async () => {
    // GIVEN a confirmation is open
    givenUsersEndpoint();
    let granted = false;
    server.use(
      http.post("/api/users/:userId/grants", () => {
        granted = true;
        return HttpResponse.json(dashboardGrant, { status: 201 });
      })
    );
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

  it("should post the subject, action and institution when a grant is confirmed", async () => {
    // GIVEN a user provisioned against inst-1, without dashboard access
    const state = givenUsersEndpoint();
    let actualUrl: URL | undefined;
    let actualBody: GrantRequest | undefined;
    server.use(
      http.post("/api/users/:userId/grants", async ({ request }) => {
        actualUrl = new URL(request.url);
        actualBody = (await request.json()) as GrantRequest;
        const created: GrantView = {
          grant_id: "grant-new",
          subject: Subject.Dashboard,
          action: Action.View,
          institution_id: "inst-1",
        };
        state[0].grants.push(created);
        return HttpResponse.json(created, { status: 201 });
      })
    );
    const rows = await renderAndWaitForRows();

    // WHEN the funder grants access and confirms
    await userEvent.click(within(rows[0]).getByTestId(ROW_TEST_ID.TOGGLE));
    await userEvent.click(await screen.findByTestId(DIALOG_TEST_ID.CONFIRM));

    // THEN the grant is posted under that user, scoped to the institution they are provisioned for
    await waitFor(() => expect(actualBody).toBeDefined());
    expect(actualUrl?.pathname).toBe("/api/users/user-1/grants");
    expect(actualBody).toEqual({ subject: "dashboard", action: "view", institution_id: "inst-1" });
  });

  it("should show the new grant once it lands, without a reload", async () => {
    // GIVEN a user without dashboard access
    const state = givenUsersEndpoint();
    server.use(
      http.post("/api/users/:userId/grants", () => {
        const created: GrantView = {
          grant_id: "grant-new",
          subject: Subject.Dashboard,
          action: Action.View,
          institution_id: "inst-1",
        };
        state[0].grants.push(created);
        return HttpResponse.json(created, { status: 201 });
      })
    );
    const rows = await renderAndWaitForRows();

    // WHEN the funder grants access and confirms
    await userEvent.click(within(rows[0]).getByTestId(ROW_TEST_ID.TOGGLE));
    await userEvent.click(await screen.findByTestId(DIALOG_TEST_ID.CONFIRM));

    // THEN the row re-reads from the server and shows the access as granted
    await waitFor(() => expect(screen.getAllByTestId(ROW_TEST_ID.TOGGLE)[0]).toHaveAttribute("aria-pressed", "true"));
  });

  it("should delete the user's own dashboard grant when access is toggled off", async () => {
    // GIVEN a user who already holds a dashboard grant
    const state = givenUsersEndpoint();
    let actualUrl: URL | undefined;
    server.use(
      http.delete("/api/users/:userId/grants/:grantId", ({ request }) => {
        actualUrl = new URL(request.url);
        state[1].grants = state[1].grants.filter((g) => g.grant_id !== dashboardGrant.grant_id);
        return new HttpResponse(null, { status: 204 });
      })
    );
    const rows = await renderAndWaitForRows();

    // WHEN the funder removes their access and confirms
    await userEvent.click(within(rows[1]).getByTestId(ROW_TEST_ID.TOGGLE));
    expect(await screen.findByTestId(DIALOG_TEST_ID.TITLE)).toHaveTextContent("Remove dashboard access?");
    await userEvent.click(screen.getByTestId(DIALOG_TEST_ID.CONFIRM));

    // THEN that user's own dashboard grant is the one deleted
    await waitFor(() => expect(actualUrl).toBeDefined());
    expect(actualUrl?.pathname).toBe(`/api/users/user-2/grants/${dashboardGrant.grant_id}`);
    // AND the row now offers the grant again
    await waitFor(() => expect(screen.getAllByTestId(ROW_TEST_ID.TOGGLE)[1]).toHaveAttribute("aria-pressed", "false"));
  });

  it("should tell the funder when the API refuses the change", async () => {
    // GIVEN the caller may not grant access
    givenUsersEndpoint();
    server.use(http.post("/api/users/:userId/grants", () => new HttpResponse(null, { status: 403 })));
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

  it("should keep the list when the reload after a saved change fails", async () => {
    // GIVEN a grant that lands, and a reload that then fails
    const state = structuredClone(givenUsers);
    let reads = 0;
    server.use(
      http.get("/api/users", () => {
        reads += 1;
        return reads > 1 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(state);
      }),
      http.post("/api/users/:userId/grants", () =>
        HttpResponse.json(
          { grant_id: "grant-new", subject: Subject.Dashboard, action: Action.View, institution_id: "inst-1" },
          { status: 201 }
        )
      )
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
    server.use(http.post("/api/users/:userId/grants", () => new HttpResponse(null, { status: 403 })));
    const rows = await renderAndWaitForRows();

    // WHEN the funder grants access and confirms
    await userEvent.click(within(rows[0]).getByTestId(ROW_TEST_ID.TOGGLE));
    await userEvent.click(await screen.findByTestId(DIALOG_TEST_ID.CONFIRM));

    // THEN the row stays as it was, rather than claiming an access that was refused
    await waitFor(() => expect(within(rows[0]).getByTestId(ROW_TEST_ID.TOGGLE)).toBeEnabled());
    expect(within(rows[0]).getByTestId(ROW_TEST_ID.TOGGLE)).toHaveAttribute("aria-pressed", "false");
  });

  it("should refuse to grant access to a user with no institution to scope it to", async () => {
    // GIVEN a registered user who holds no grants at all
    givenUsersEndpoint([{ user_id: "user-9", email: "new.joiner@example.com", name: "New Joiner", grants: [] }]);

    // WHEN the screen has loaded
    const rows = await renderAndWaitForRows();

    // THEN their row says so, and offers no way to grant
    expect(within(rows[0]).getByTestId(ROW_TEST_ID.DETAIL)).toHaveTextContent("No institution assigned");
    expect(within(rows[0]).getByTestId(ROW_TEST_ID.TOGGLE)).toBeDisabled();
  });

  it("should offer a retry when the user list cannot be loaded", async () => {
    // GIVEN the users endpoint fails
    server.use(http.get("/api/users", () => new HttpResponse(null, { status: 500 })));

    // WHEN the screen is opened
    render(<UserAccess />);

    // THEN the failure is shown, with a way to try again
    const error = await screen.findByTestId(DATA_TEST_ID.ERROR);
    expect(error).toHaveTextContent("Failed to load dashboard access.");
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

  it("should say so when there are no users to grant access to", async () => {
    // GIVEN no users are provisioned
    givenUsersEndpoint([]);

    // WHEN the screen has loaded
    render(<UserAccess />);

    // THEN it says so, rather than showing an empty box
    expect(await screen.findByText("There are no users to grant access to yet.")).toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.LIST)).not.toBeInTheDocument();
  });
});
