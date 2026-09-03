import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { AuthProvider } from "@/auth/AuthContext";
import { AccessProvider, type AccessScope } from "@/access/AccessContext";
import { Settings, DATA_TEST_ID } from "./Settings";

// The Firebase stub in src/test/setup.ts signs in as this user, so it is what the card reads.
const SIGNED_IN_EMAIL = "test@example.com";

function renderSettings(
  options: { scope?: AccessScope; role?: string | null; name?: string | null; organization?: string | null } = {}
) {
  return render(
    <AuthProvider>
      <AccessProvider
        scope={options.scope}
        role={options.role ?? null}
        name={options.name ?? null}
        organization={options.organization ?? null}
      >
        <Settings />
      </AccessProvider>
    </AuthProvider>
  );
}

/** The card's rows are a definition list, so a row is found by its term and read from its value. */
function valueOfDetail(label: string): string {
  const row = screen
    .getAllByTestId(DATA_TEST_ID.PROFILE_DETAIL)
    .find((detail) => within(detail).queryByText(label) !== null);
  if (!row) throw new Error(`No profile detail labelled "${label}"`);
  return row.querySelector("dd")?.textContent ?? "";
}

describe("Settings", () => {
  it("should render the account screen heading", () => {
    // GIVEN a signed-in user
    // WHEN the screen renders
    renderSettings();

    // THEN it announces itself as the account screen
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Profile & settings" })).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("should show the signed-in user's email", () => {
    // GIVEN a signed-in user
    // WHEN the profile card renders
    renderSettings();

    // THEN their email is on it
    expect(valueOfDetail("Email")).toBe(SIGNED_IN_EMAIL);
  });

  it("should name the role the caller's permissions add up to", () => {
    // GIVEN a caller whose grants make them a funder
    // WHEN the profile card renders
    renderSettings({ role: "funder" });

    // THEN the card shows the role name from the backend
    expect(valueOfDetail("Role")).toBe("funder");
  });

  it("should fall back to a dash when the permissions match no known role", () => {
    // GIVEN a caller holding permissions that add up to no role
    // WHEN the profile card renders
    renderSettings({ role: null });

    // THEN the row is still there, saying it doesn't know
    expect(valueOfDetail("Role")).toBe("—");
  });

  it("should describe a deployment-wide grant as covering every institution", () => {
    // GIVEN a grant over the whole deployment
    // WHEN the profile card renders
    renderSettings({ scope: { type: "all" } });

    // THEN the scope names no count — every institution is covered, not some fixed number
    expect(valueOfDetail("Data scope")).toBe("All institutions");
  });

  it("should count the institutions a narrower grant covers", () => {
    // GIVEN a grant over three institutions
    // WHEN the profile card renders
    renderSettings({ scope: { type: "institutions", institutionIds: ["a", "b", "c"] } });

    // THEN the scope reports how many
    expect(valueOfDetail("Data scope")).toBe("3 institutions");
  });

  it("should say 'institution' in the singular for a grant covering one", () => {
    // GIVEN a grant over a single institution
    // WHEN the profile card renders
    renderSettings({ scope: { type: "institutions", institutionIds: ["a"] } });

    // THEN the count reads as English, not "1 institutions"
    expect(valueOfDetail("Data scope")).toBe("1 institution");
  });

  it("should offer nothing to edit on Role or Data scope — only the whole-profile edit action", () => {
    // GIVEN the profile card
    // WHEN it renders
    renderSettings();

    // THEN the only button on the card is the single edit-profile action
    const buttons = within(screen.getByTestId(DATA_TEST_ID.PROFILE_CARD)).getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("data-testid"))).toEqual([DATA_TEST_ID.EDIT_PROFILE_BUTTON]);
  });

  it("should show the organization on record", () => {
    // GIVEN a caller with an organization on record
    // WHEN the profile card renders
    renderSettings({ organization: "Acme Corp" });

    // THEN it's on the card
    expect(valueOfDetail("Organization")).toBe("Acme Corp");
  });

  it("should fall back to a dash when no organization is on record", () => {
    // GIVEN a caller with no organization on record
    // WHEN the profile card renders
    renderSettings({ organization: null });

    // THEN the row still renders, saying it doesn't know
    expect(valueOfDetail("Organization")).toBe("—");
  });

  it("should fall back to the backend's name when the Firebase client has none of its own", () => {
    // GIVEN a signed-in Firebase user with no displayName (the shared test stub, see setup.ts),
    // but a name on record from the backend
    renderSettings({ name: "Jordan Avila" });

    // THEN the card shows that name instead of the "My account" placeholder
    expect(screen.getByTestId(DATA_TEST_ID.PROFILE_NAME)).toHaveTextContent("Jordan Avila");
  });

  it("should turn both name and organization into inputs at once when editing starts", async () => {
    // GIVEN a caller with a name and organization on record
    renderSettings({ name: "Jordan Avila", organization: "Acme Corp" });

    // WHEN they start editing
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.EDIT_PROFILE_BUTTON));

    // THEN both fields become editable together, pre-filled with their current values
    expect(screen.getByTestId(DATA_TEST_ID.NAME_INPUT)).toHaveValue("Jordan Avila");
    expect(screen.getByTestId(DATA_TEST_ID.ORGANIZATION_INPUT)).toHaveValue("Acme Corp");
    // AND the single edit trigger is replaced by Save and Cancel
    expect(screen.queryByTestId(DATA_TEST_ID.EDIT_PROFILE_BUTTON)).not.toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.SAVE_PROFILE_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.CANCEL_PROFILE_BUTTON)).toBeInTheDocument();
  });

  it("should start with empty inputs for whichever fields have no value yet", async () => {
    // GIVEN no name or organization on record anywhere
    renderSettings();

    // WHEN editing starts
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.EDIT_PROFILE_BUTTON));

    // THEN neither input is pre-filled with a placeholder string
    expect(screen.getByTestId(DATA_TEST_ID.NAME_INPUT)).toHaveValue("");
    expect(screen.getByTestId(DATA_TEST_ID.ORGANIZATION_INPUT)).toHaveValue("");
  });

  it("should save both fields together and return to the read-only card", async () => {
    // GIVEN a caller with a name and organization on record, and the endpoint records what it's sent
    let actualBody: unknown;
    server.use(
      http.post("/api/users/register", async ({ request }) => {
        actualBody = await request.json();
        return new HttpResponse(null, { status: 201 });
      })
    );
    renderSettings({ name: "Jordan Avila", organization: "Acme Corp" });

    // WHEN they edit both fields and save
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.EDIT_PROFILE_BUTTON));
    await userEvent.clear(screen.getByTestId(DATA_TEST_ID.NAME_INPUT));
    await userEvent.type(screen.getByTestId(DATA_TEST_ID.NAME_INPUT), "Kunda Tembo");
    await userEvent.clear(screen.getByTestId(DATA_TEST_ID.ORGANIZATION_INPUT));
    await userEvent.type(screen.getByTestId(DATA_TEST_ID.ORGANIZATION_INPUT), "Ndola Livelihoods Trust");
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.SAVE_PROFILE_BUTTON));

    // THEN both edited values are sent in the one request, not just reflected optimistically
    await waitFor(() => expect(actualBody).toEqual({ name: "Kunda Tembo", organization: "Ndola Livelihoods Trust" }));
    // AND the card shows both new values, back in its read-only state
    expect(screen.getByTestId(DATA_TEST_ID.PROFILE_NAME)).toHaveTextContent("Kunda Tembo");
    expect(valueOfDetail("Organization")).toBe("Ndola Livelihoods Trust");
    expect(screen.queryByTestId(DATA_TEST_ID.NAME_INPUT)).not.toBeInTheDocument();
  });

  it("should require a name to save, but allow organization to stay empty", async () => {
    // GIVEN a caller with a name already on record
    renderSettings({ name: "Jordan Avila" });

    // WHEN they clear the name while editing
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.EDIT_PROFILE_BUTTON));
    await userEvent.clear(screen.getByTestId(DATA_TEST_ID.NAME_INPUT));

    // THEN saving is blocked — organization alone isn't enough to identify the person
    expect(screen.getByTestId(DATA_TEST_ID.SAVE_PROFILE_BUTTON)).toBeDisabled();
  });

  it("should discard both drafts and keep the original values when editing is cancelled", async () => {
    // GIVEN a caller with a name and organization on record
    renderSettings({ name: "Jordan Avila", organization: "Acme Corp" });

    // WHEN they start editing, change both drafts, then cancel
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.EDIT_PROFILE_BUTTON));
    await userEvent.clear(screen.getByTestId(DATA_TEST_ID.NAME_INPUT));
    await userEvent.type(screen.getByTestId(DATA_TEST_ID.NAME_INPUT), "Someone Else");
    await userEvent.clear(screen.getByTestId(DATA_TEST_ID.ORGANIZATION_INPUT));
    await userEvent.type(screen.getByTestId(DATA_TEST_ID.ORGANIZATION_INPUT), "Some Other Org");
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.CANCEL_PROFILE_BUTTON));

    // THEN both original values are shown, unaffected
    expect(screen.getByTestId(DATA_TEST_ID.PROFILE_NAME)).toHaveTextContent("Jordan Avila");
    expect(valueOfDetail("Organization")).toBe("Acme Corp");
  });

  it("should keep the editor open when saving fails, so neither draft is lost", async () => {
    // GIVEN the save request fails
    server.use(http.post("/api/users/register", () => new HttpResponse(null, { status: 500 })));
    renderSettings({ name: "Jordan Avila", organization: "Acme Corp" });

    // WHEN they try to save an edit
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.EDIT_PROFILE_BUTTON));
    await userEvent.clear(screen.getByTestId(DATA_TEST_ID.NAME_INPUT));
    await userEvent.type(screen.getByTestId(DATA_TEST_ID.NAME_INPUT), "Kunda Tembo");
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.SAVE_PROFILE_BUTTON));

    // THEN the editor is still there, still holding what they typed — nothing is lost
    await waitFor(() => expect(screen.getByTestId(DATA_TEST_ID.SAVE_PROFILE_BUTTON)).not.toBeDisabled());
    expect(screen.getByTestId(DATA_TEST_ID.NAME_INPUT)).toHaveValue("Kunda Tembo");
  });
});
