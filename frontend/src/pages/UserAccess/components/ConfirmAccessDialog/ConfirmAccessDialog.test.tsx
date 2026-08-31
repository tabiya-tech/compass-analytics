import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import userEvent from "@testing-library/user-event";
import { Role } from "@/access/roles";
import { grantsForRole } from "@/_test_utilities/role-grants";
import type { InstitutionChoicesState } from "@/pages/UserAccess/hooks/useInstitutionChoices";
import type { UserAccessEntry } from "@/pages/UserAccess/hooks/useUserAccess";
import { ConfirmAccessDialog, DATA_TEST_ID } from "./ConfirmAccessDialog";

const givenInstitutions: InstitutionChoicesState = {
  status: "success",
  items: [
    { id: "inst-1", name: "Lusaka Skills Hub" },
    { id: "inst-2", name: "Ndola Livelihoods Trust" },
  ],
};

const givenUngrantedEntry: UserAccessEntry = {
  user: { user_id: "user-7", email: "vaani.mumba@example.com", name: "Vaani Mumba", grants: [] },
  role: null,
  hasAccess: false,
};

const givenGrantedEntry: UserAccessEntry = {
  user: { ...givenUngrantedEntry.user, grants: grantsForRole(Role.Implementer) },
  role: Role.Implementer,
  hasAccess: true,
};

/** The screen owns the chosen role, so the dialog is always rendered with one. */
function renderDialog(props: Partial<ComponentProps<typeof ConfirmAccessDialog>> = {}) {
  const resolved = {
    entry: givenUngrantedEntry,
    role: Role.Funder,
    onRoleChange: vi.fn(),
    institutions: givenInstitutions,
    institutionId: null,
    onInstitutionChange: vi.fn(),
    onConfirm: vi.fn(),
    onOpenChange: vi.fn(),
    ...props,
  };
  render(<ConfirmAccessDialog {...resolved} />);
  return resolved;
}

describe("ConfirmAccessDialog", () => {
  it("should ask the funder to confirm a grant, naming the user who gains access", () => {
    // GIVEN a user who is about to be granted access
    // WHEN the dialog asks the funder to confirm
    renderDialog();

    // THEN it names who gains access, and says what the role choice below decides
    expect(screen.getByTestId(DATA_TEST_ID.TITLE)).toHaveTextContent("Grant access");
    expect(screen.getByTestId(DATA_TEST_ID.DESCRIPTION)).toHaveTextContent(
      "Choose a role for Vaani Mumba. It determines which pages they can access."
    );
    // AND the name stands out from the sentence around it
    expect(screen.getByText("Vaani Mumba").tagName).toBe("STRONG");
    // AND the action that writes the grant says what it does
    expect(screen.getByTestId(DATA_TEST_ID.CONFIRM)).toHaveTextContent("Grant access");
  });

  it("should offer the role to grant, named and labelled", () => {
    // GIVEN a grant awaiting confirmation
    // WHEN the dialog is rendered
    renderDialog();

    // THEN the role is picked from a labelled control, not assumed
    const select = screen.getByTestId(DATA_TEST_ID.ROLE_SELECT);
    expect(screen.getByRole("combobox", { name: "Role" })).toBe(select);
    expect(select).toHaveTextContent("Funder");
    // AND what that role opens up is spelled out, so it is not chosen from a name alone
    expect(screen.getByTestId(DATA_TEST_ID.ROLE_HINT)).toHaveTextContent(
      "Sees every page except Jobseekers. Can grant access to other users."
    );
  });

  it("should describe the role the funder has chosen, not the one it opened on", () => {
    // GIVEN the funder has switched the choice to implementer
    // WHEN the dialog renders with that role
    renderDialog({ role: Role.Implementer });

    // THEN the control and the hint both describe that role
    expect(screen.getByTestId(DATA_TEST_ID.ROLE_SELECT)).toHaveTextContent("Implementer");
    expect(screen.getByTestId(DATA_TEST_ID.ROLE_HINT)).toHaveTextContent(
      "Sees every page except Institutions, for one institution only. Cannot grant access to other users."
    );
  });

  it("should report the role the funder picks, leaving the choice to the screen", async () => {
    // GIVEN a grant awaiting confirmation, opened on the default funder role
    const { onRoleChange } = renderDialog();

    // WHEN the funder picks the implementer role instead
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.ROLE_SELECT));
    await userEvent.click(await screen.findByRole("option", { name: "Implementer" }));

    // THEN the choice is reported, and nothing is written by the dialog itself
    expect(onRoleChange).toHaveBeenCalledExactlyOnceWith(Role.Implementer);
  });

  it("should offer only the roles a funder may hand out", async () => {
    // GIVEN a grant awaiting confirmation
    renderDialog();

    // WHEN the role control is opened
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.ROLE_SELECT));

    // THEN only implementer and funder are on offer — super admin is not granted from here
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Implementer", "Funder"]);
  });

  it("should not ask for an institution for a role that covers the whole deployment", () => {
    // GIVEN the funder role, which oversees every institution
    // WHEN the dialog is rendered
    renderDialog({ role: Role.Funder });

    // THEN there is no institution to pick — the role is not scoped to one
    expect(screen.queryByTestId(DATA_TEST_ID.INSTITUTION_FIELD)).not.toBeInTheDocument();
  });

  it("should ask which institution an implementer is being given", () => {
    // GIVEN the implementer role, which belongs to a single institution
    // WHEN the dialog is rendered with it
    renderDialog({ role: Role.Implementer });

    // THEN an institution is asked for, labelled and explained
    expect(screen.getByRole("combobox", { name: "Institution" })).toBe(
      screen.getByTestId(DATA_TEST_ID.INSTITUTION_SELECT)
    );
    expect(screen.getByTestId(DATA_TEST_ID.INSTITUTION_HINT)).toHaveTextContent(
      "An implementer only sees data for the institution you choose here."
    );
  });

  it("should offer every institution the deployment holds", async () => {
    // GIVEN an implementer grant awaiting an institution
    renderDialog({ role: Role.Implementer });

    // WHEN the institution control is opened
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.INSTITUTION_SELECT));

    // THEN the institutions are offered by name, not by the id the grant carries
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Lusaka Skills Hub", "Ndola Livelihoods Trust"]);
  });

  it("should report the institution the funder picks, leaving the choice to the screen", async () => {
    // GIVEN an implementer grant awaiting an institution
    const { onInstitutionChange } = renderDialog({ role: Role.Implementer });

    // WHEN the funder picks one
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.INSTITUTION_SELECT));
    await userEvent.click(await screen.findByRole("option", { name: "Ndola Livelihoods Trust" }));

    // THEN its id is reported — the name is for reading, the id is what the grant is scoped to
    expect(onInstitutionChange).toHaveBeenCalledExactlyOnceWith("inst-2");
  });

  it("should hold an implementer grant until an institution has been picked for it", () => {
    // GIVEN an implementer grant with no institution chosen yet
    // WHEN the dialog is rendered
    renderDialog({ role: Role.Implementer, institutionId: null });

    // THEN it cannot be confirmed — an implementer without an institution has no scope at all
    expect(screen.getByTestId(DATA_TEST_ID.CONFIRM)).toBeDisabled();
  });

  it("should let the grant through once an institution has been picked", () => {
    // GIVEN an implementer grant with an institution chosen
    // WHEN the dialog is rendered
    renderDialog({ role: Role.Implementer, institutionId: "inst-1" });

    // THEN it can be confirmed, showing the institution it will be scoped to
    expect(screen.getByTestId(DATA_TEST_ID.CONFIRM)).toBeEnabled();
    expect(screen.getByTestId(DATA_TEST_ID.INSTITUTION_SELECT)).toHaveTextContent("Lusaka Skills Hub");
  });

  it("should say the institutions are still coming rather than offer an empty list", () => {
    // GIVEN the institutions have not arrived yet
    // WHEN an implementer grant is being confirmed
    renderDialog({ role: Role.Implementer, institutions: { status: "loading" } });

    // THEN the control says so and cannot be opened on nothing
    expect(screen.getByTestId(DATA_TEST_ID.INSTITUTION_SELECT)).toHaveTextContent("Loading institutions…");
    expect(screen.getByTestId(DATA_TEST_ID.INSTITUTION_SELECT)).toBeDisabled();
  });

  it("should say so when the institutions could not be loaded, rather than grant an unscoped role", () => {
    // GIVEN the institutions failed to load
    // WHEN an implementer grant is being confirmed
    renderDialog({ role: Role.Implementer, institutions: { status: "error", retry: vi.fn() } });

    // THEN the failure is stated, and nothing can be granted without a scope to grant it at
    expect(screen.getByTestId(DATA_TEST_ID.INSTITUTION_ERROR)).toHaveTextContent(
      "Institutions could not be loaded, so this role cannot be scoped yet."
    );
    expect(screen.getByTestId(DATA_TEST_ID.CONFIRM)).toBeDisabled();
  });

  it("should ask the funder to confirm a removal, and say what the user is left able to do", () => {
    // GIVEN a user whose access is about to be removed
    // WHEN the dialog asks the funder to confirm
    renderDialog({ entry: givenGrantedEntry });

    // THEN it names who loses access, and is plain that the account itself survives
    expect(screen.getByTestId(DATA_TEST_ID.TITLE)).toHaveTextContent("Remove access");
    expect(screen.getByTestId(DATA_TEST_ID.DESCRIPTION)).toHaveTextContent(
      "Are you sure you want to remove Vaani Mumba's dashboard access?"
    );
    expect(screen.getByTestId(DATA_TEST_ID.DESCRIPTION)).toHaveTextContent(
      "They will still be able to sign in, but they won't be able to access any pages until you assign them a role again."
    );
    expect(screen.getByTestId(DATA_TEST_ID.CONFIRM)).toHaveTextContent("Remove access");
  });

  it("should not offer a role to pick when access is being removed", () => {
    // GIVEN a removal awaiting confirmation
    // WHEN the dialog is rendered
    renderDialog({ entry: givenGrantedEntry });

    // THEN there is no role to choose — the whole role is going
    expect(screen.queryByTestId(DATA_TEST_ID.ROLE_SELECT)).not.toBeInTheDocument();
  });

  it("should open with the focus on cancelling, so a stray keystroke changes nothing", () => {
    // GIVEN a change awaiting confirmation
    // WHEN the dialog opens
    renderDialog({ entry: givenGrantedEntry });

    // THEN the focus sits on the way out, not on the action that writes the grant
    expect(screen.getByTestId(DATA_TEST_ID.CANCEL)).toHaveFocus();
  });

  it("should report the confirmation, leaving the API call to the screen", async () => {
    // GIVEN a change awaiting confirmation
    const { onConfirm } = renderDialog();

    // WHEN the funder confirms it
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.CONFIRM));

    // THEN the dialog reports the confirmation and nothing else
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("should ask only to be closed when the funder cancels", async () => {
    // GIVEN a change awaiting confirmation
    const { onConfirm, onOpenChange } = renderDialog({ entry: givenGrantedEntry });

    // WHEN the funder cancels
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.CANCEL));

    // THEN the dialog is closed, and the access is left as it was
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("should show nothing at all when there is no change to confirm", () => {
    // GIVEN nothing has been toggled
    // WHEN the dialog is rendered
    renderDialog({ entry: null });

    // THEN there is no dialog on screen
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
