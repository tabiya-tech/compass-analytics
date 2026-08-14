import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import userEvent from "@testing-library/user-event";
import { Action, Subject } from "@/access/AccessContext";
import { ALL_INSTITUTIONS, type GrantView } from "@/user/user.types";
import type { UserAccessEntry } from "@/pages/UserAccess/hooks/useUserAccess";
import { AccessRow, DATA_TEST_ID } from "./AccessRow";

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

describe("AccessRow", () => {
  it("should name the user, and the email and institution their access is scoped to", () => {
    // GIVEN a user who has no dashboard access yet
    // WHEN the row is rendered
    render(<AccessRow entry={givenUngrantedEntry} onToggle={vi.fn()} />);

    // THEN it names the person, their email, and the institution their grants are scoped to
    expect(screen.getByTestId(DATA_TEST_ID.USER)).toHaveTextContent("Vaani Mumba");
    expect(screen.getByTestId(DATA_TEST_ID.DETAIL)).toHaveTextContent("vaani.mumba@example.com · inst-7");
  });

  it("should fall back to the email when the user has no name", () => {
    // GIVEN a user the backend returned without a name
    const givenNameless: UserAccessEntry = {
      ...givenUngrantedEntry,
      user: { ...givenUngrantedEntry.user, name: null },
    };

    // WHEN the row is rendered
    render(<AccessRow entry={givenNameless} onToggle={vi.fn()} />);

    // THEN the email stands in for the name, rather than leaving the row blank
    expect(screen.getByTestId(DATA_TEST_ID.USER)).toHaveTextContent("vaani.mumba@example.com");
    // AND it is not repeated underneath
    expect(screen.getByTestId(DATA_TEST_ID.DETAIL)).toHaveTextContent("inst-7");
  });

  it("should fall back to the email when the user's name comes back empty", () => {
    // GIVEN a user the backend returned with a blank name, as a sign-up with no display name leaves
    const givenBlankName: UserAccessEntry = {
      ...givenUngrantedEntry,
      user: { ...givenUngrantedEntry.user, name: "" },
    };

    // WHEN the row is rendered
    render(<AccessRow entry={givenBlankName} onToggle={vi.fn()} />);

    // THEN the email still identifies them, rather than the row naming nobody
    expect(screen.getByTestId(DATA_TEST_ID.USER)).toHaveTextContent("vaani.mumba@example.com");
  });

  it("should name the deployment-wide scope rather than showing its sentinel", () => {
    // GIVEN a user whose grants cover every institution
    const givenDeploymentWide: UserAccessEntry = { ...givenUngrantedEntry, institutionId: ALL_INSTITUTIONS };

    // WHEN the row is rendered
    render(<AccessRow entry={givenDeploymentWide} onToggle={vi.fn()} />);

    // THEN the scope reads as words, not as the "*" the API uses
    expect(screen.getByTestId(DATA_TEST_ID.DETAIL)).toHaveTextContent("All institutions");
    expect(screen.getByTestId(DATA_TEST_ID.DETAIL)).not.toHaveTextContent("*");
  });

  it("should offer to grant access when the user holds no dashboard grant", () => {
    // GIVEN a user who has no dashboard access yet
    // WHEN the row is rendered
    render(<AccessRow entry={givenUngrantedEntry} onToggle={vi.fn()} />);

    // THEN the toggle invites the funder to grant it, and reads as not pressed
    const toggle = screen.getByTestId(DATA_TEST_ID.TOGGLE);
    expect(toggle).toHaveTextContent("Grant access");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    // AND it names the user it acts on, since the visible label repeats down the list
    expect(toggle).toHaveAccessibleName("Grant access to Vaani Mumba");
  });

  it("should show access as granted when the user holds a dashboard grant", () => {
    // GIVEN a user who already has dashboard access
    // WHEN the row is rendered
    render(<AccessRow entry={givenGrantedEntry} onToggle={vi.fn()} />);

    // THEN the toggle reports the access as granted, and reads as pressed
    const toggle = screen.getByTestId(DATA_TEST_ID.TOGGLE);
    expect(toggle).toHaveTextContent("Access granted");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("should refuse to grant access to a user with no institution to scope it to", () => {
    // GIVEN a registered user who holds no grants at all, so nothing names their institution
    const givenUnscoped: UserAccessEntry = {
      user: { user_id: "user-9", email: "new.joiner@example.com", name: "New Joiner", grants: [] },
      institutionId: null,
      dashboardGrant: null,
    };

    // WHEN the row is rendered
    render(<AccessRow entry={givenUnscoped} onToggle={vi.fn()} />);

    // THEN the row says so, and the toggle cannot be used
    expect(screen.getByTestId(DATA_TEST_ID.DETAIL)).toHaveTextContent("No institution assigned");
    expect(screen.getByTestId(DATA_TEST_ID.TOGGLE)).toBeDisabled();
  });

  it("should hand the whole entry back when the toggle is used", async () => {
    // GIVEN a row with a toggle handler
    const givenOnToggle = vi.fn();
    render(<AccessRow entry={givenUngrantedEntry} onToggle={givenOnToggle} />);

    // WHEN the funder grants access
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.TOGGLE));

    // THEN the handler is given the entry, which carries the user, their institution and any grant
    expect(givenOnToggle).toHaveBeenCalledExactlyOnceWith(givenUngrantedEntry);
  });

  it("should not accept another toggle while this row's grant is in flight", async () => {
    // GIVEN a row whose grant is mid-flight
    const givenOnToggle = vi.fn();
    render(<AccessRow entry={givenUngrantedEntry} onToggle={givenOnToggle} pending />);

    // WHEN the funder clicks the toggle again
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.TOGGLE));

    // THEN nothing is asked of the API a second time
    expect(screen.getByTestId(DATA_TEST_ID.TOGGLE)).toBeDisabled();
    expect(givenOnToggle).not.toHaveBeenCalled();
  });
});
