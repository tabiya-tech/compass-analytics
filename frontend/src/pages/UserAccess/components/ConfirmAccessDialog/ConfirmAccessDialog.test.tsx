import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import userEvent from "@testing-library/user-event";
import { Action, Subject } from "@/access/AccessContext";
import type { GrantView } from "@/user/user.types";
import type { UserAccessEntry } from "@/pages/UserAccess/hooks/useUserAccess";

const givenDashboardGrant: GrantView = {
  grant_id: "grant-7",
  subject: Subject.Dashboard,
  action: Action.View,
  institution_id: "inst-7",
};

const givenUngrantedEntry: UserAccessEntry = {
  user: {
    user_id: "user-7",
    email: "vaani.mumba@example.com",
    name: "Vaani Mumba",
    grants: [{ grant_id: "grant-6", subject: Subject.Jobseekers, action: Action.View, institution_id: "inst-7" }],
  },
  institutionId: "inst-7",
  dashboardGrant: null,
};

const givenGrantedEntry: UserAccessEntry = {
  ...givenUngrantedEntry,
  user: { ...givenUngrantedEntry.user, grants: [givenDashboardGrant] },
  dashboardGrant: givenDashboardGrant,
};
import { ConfirmAccessDialog, DATA_TEST_ID } from "./ConfirmAccessDialog";

describe("ConfirmAccessDialog", () => {
  it("should ask the funder to confirm a grant, naming the user who gains access", () => {
    // GIVEN a user who is about to be granted access
    // WHEN the dialog asks the funder to confirm
    render(<ConfirmAccessDialog entry={givenUngrantedEntry} onConfirm={vi.fn()} onOpenChange={vi.fn()} />);

    // THEN it asks about granting, and names who gains access
    expect(screen.getByTestId(DATA_TEST_ID.TITLE)).toHaveTextContent("Grant dashboard access?");
    expect(screen.getByTestId(DATA_TEST_ID.DESCRIPTION)).toHaveTextContent(
      "Are you sure you want to grant Vaani Mumba access to the dashboard for their institution?"
    );
    // AND the name stands out from the question around it
    expect(screen.getByText("Vaani Mumba").tagName).toBe("STRONG");
    // AND the action that writes the grant says what it does
    expect(screen.getByTestId(DATA_TEST_ID.CONFIRM)).toHaveTextContent("Grant access");
  });

  it("should ask the funder to confirm a removal, naming the user who loses access", () => {
    // GIVEN a user whose access is about to be removed
    // WHEN the dialog asks the funder to confirm
    render(<ConfirmAccessDialog entry={givenGrantedEntry} onConfirm={vi.fn()} onOpenChange={vi.fn()} />);

    // THEN it asks about removing, and names who loses access
    expect(screen.getByTestId(DATA_TEST_ID.TITLE)).toHaveTextContent("Remove dashboard access?");
    expect(screen.getByTestId(DATA_TEST_ID.DESCRIPTION)).toHaveTextContent(
      "Are you sure you want to remove Vaani Mumba's access to the dashboard?"
    );
    expect(screen.getByTestId(DATA_TEST_ID.CONFIRM)).toHaveTextContent("Remove access");
  });

  it("should open with the focus on cancelling, so a stray keystroke changes nothing", () => {
    // GIVEN a change awaiting confirmation
    // WHEN the dialog opens
    render(<ConfirmAccessDialog entry={givenGrantedEntry} onConfirm={vi.fn()} onOpenChange={vi.fn()} />);

    // THEN the focus sits on the way out, not on the action that writes the grant
    expect(screen.getByTestId(DATA_TEST_ID.CANCEL)).toHaveFocus();
  });

  it("should report the confirmation, leaving the API call to the screen", async () => {
    // GIVEN a change awaiting confirmation
    const givenOnConfirm = vi.fn();
    render(<ConfirmAccessDialog entry={givenUngrantedEntry} onConfirm={givenOnConfirm} onOpenChange={vi.fn()} />);

    // WHEN the funder confirms it
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.CONFIRM));

    // THEN the dialog reports the confirmation and nothing else
    expect(givenOnConfirm).toHaveBeenCalledOnce();
  });

  it("should ask only to be closed when the funder cancels", async () => {
    // GIVEN a change awaiting confirmation
    const givenOnConfirm = vi.fn();
    const givenOnOpenChange = vi.fn();
    render(
      <ConfirmAccessDialog entry={givenGrantedEntry} onConfirm={givenOnConfirm} onOpenChange={givenOnOpenChange} />
    );

    // WHEN the funder cancels
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.CANCEL));

    // THEN the dialog is closed, and the access is left as it was
    expect(givenOnOpenChange).toHaveBeenCalledWith(false);
    expect(givenOnConfirm).not.toHaveBeenCalled();
  });

  it("should show nothing at all when there is no change to confirm", () => {
    // GIVEN nothing has been toggled
    // WHEN the dialog is rendered
    render(<ConfirmAccessDialog entry={null} onConfirm={vi.fn()} onOpenChange={vi.fn()} />);

    // THEN there is no dialog on screen
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
