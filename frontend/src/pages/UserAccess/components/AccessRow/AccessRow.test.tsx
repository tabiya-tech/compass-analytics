import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import userEvent from "@testing-library/user-event";
import { stubRoleRecord, userRoleFor } from "@/_test_utilities/role-grants";
import type { UserAccessEntry } from "@/pages/UserAccess/hooks/useUserAccess";
import { AccessRow, DATA_TEST_ID } from "./AccessRow";

const IMPLEMENTER = stubRoleRecord({ _id: "role-implementer", name: "implementer", label: "Implementer" });
const FUNDER = stubRoleRecord({ _id: "role-funder", name: "funder", label: "Funder" });

const givenUngrantedEntry: UserAccessEntry = {
  user: { user_id: "user-7", email: "vaani.mumba@example.com", name: "Vaani Mumba", roles: [] },
  role: null,
  hasAccess: false,
};

const givenImplementerEntry: UserAccessEntry = {
  user: { ...givenUngrantedEntry.user, roles: [userRoleFor(IMPLEMENTER._id, "inst-1")] },
  role: IMPLEMENTER,
  hasAccess: true,
};

describe("AccessRow", () => {
  it("should name the user, their email and the access they hold", () => {
    // GIVEN a user who has been given the implementer role
    // WHEN the row is rendered
    render(<AccessRow entry={givenImplementerEntry} onToggle={vi.fn()} />);

    // THEN it names the person, their email, and the role their assignments add up to
    expect(screen.getByTestId(DATA_TEST_ID.USER)).toHaveTextContent("Vaani Mumba");
    expect(screen.getByTestId(DATA_TEST_ID.DETAIL)).toHaveTextContent("vaani.mumba@example.com · Implementer");
  });

  it("should name the funder role for a user who holds it", () => {
    // GIVEN a user who has been given the funder role
    const givenFunder: UserAccessEntry = {
      user: { ...givenUngrantedEntry.user, roles: [userRoleFor(FUNDER._id)] },
      role: FUNDER,
      hasAccess: true,
    };

    // WHEN the row is rendered
    render(<AccessRow entry={givenFunder} onToggle={vi.fn()} />);

    // THEN the row names that role, not the other one
    expect(screen.getByTestId(DATA_TEST_ID.DETAIL)).toHaveTextContent("Funder");
    expect(screen.getByTestId(DATA_TEST_ID.DETAIL)).not.toHaveTextContent("Implementer");
  });

  it("should say a user holds no access yet when they hold no roles", () => {
    // GIVEN a registered user nobody has assigned anything to
    // WHEN the row is rendered
    render(<AccessRow entry={givenUngrantedEntry} onToggle={vi.fn()} />);

    // THEN the row says so, rather than naming a role they do not have
    expect(screen.getByTestId(DATA_TEST_ID.DETAIL)).toHaveTextContent("No access yet");
  });

  it("should not claim a role for a user whose assignment resolves to none", () => {
    // GIVEN a user assigned a role that is no longer in the known roles
    const givenUnknownRole: UserAccessEntry = {
      user: {
        ...givenUngrantedEntry.user,
        roles: [userRoleFor("role-deleted")],
      },
      role: null,
      hasAccess: true,
    };

    // WHEN the row is rendered
    render(<AccessRow entry={givenUnknownRole} onToggle={vi.fn()} />);

    // THEN their access is reported without overstating it as a role
    expect(screen.getByTestId(DATA_TEST_ID.DETAIL)).toHaveTextContent("Custom permissions");
    expect(screen.getByTestId(DATA_TEST_ID.TOGGLE)).toHaveAttribute("aria-pressed", "true");
  });

  it("should fall back to the email when the user has no name", () => {
    // GIVEN a user the backend returned without a name
    const givenNameless: UserAccessEntry = {
      ...givenImplementerEntry,
      user: { ...givenImplementerEntry.user, name: null },
    };

    // WHEN the row is rendered
    render(<AccessRow entry={givenNameless} onToggle={vi.fn()} />);

    // THEN the email stands in for the name, rather than leaving the row blank
    expect(screen.getByTestId(DATA_TEST_ID.USER)).toHaveTextContent("vaani.mumba@example.com");
    // AND it is not repeated underneath
    expect(screen.getByTestId(DATA_TEST_ID.DETAIL)).toHaveTextContent("Implementer");
    expect(screen.getByTestId(DATA_TEST_ID.DETAIL)).not.toHaveTextContent("vaani.mumba@example.com");
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

  it("should offer to grant access when the user holds none", () => {
    // GIVEN a user who has no access yet
    // WHEN the row is rendered
    render(<AccessRow entry={givenUngrantedEntry} onToggle={vi.fn()} />);

    // THEN the toggle invites the funder to grant it, and reads as not pressed
    const toggle = screen.getByTestId(DATA_TEST_ID.TOGGLE);
    expect(toggle).toHaveTextContent("Grant access");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    // AND it names the user it acts on, since the visible label repeats down the list
    expect(toggle).toHaveAccessibleName("Grant access to Vaani Mumba");
  });

  it("should show access as granted when the user holds a role", () => {
    // GIVEN a user who already holds the implementer role
    // WHEN the row is rendered
    render(<AccessRow entry={givenImplementerEntry} onToggle={vi.fn()} />);

    // THEN the toggle reports the access as granted, and reads as pressed
    const toggle = screen.getByTestId(DATA_TEST_ID.TOGGLE);
    expect(toggle).toHaveTextContent("Access granted");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("should offer the grant to a user with no assignments to derive an institution from", () => {
    // GIVEN a newly registered user, whose assignments name no institution
    // WHEN the row is rendered
    render(<AccessRow entry={givenUngrantedEntry} onToggle={vi.fn()} />);

    // THEN the toggle still works — a role covers the whole deployment, so there is nothing to scope
    expect(screen.getByTestId(DATA_TEST_ID.TOGGLE)).toBeEnabled();
  });

  it("should shade each toggle's own colour on hover, rather than switch it", () => {
    // GIVEN a row offering the grant, and a row reporting it as granted
    const { rerender } = render(<AccessRow entry={givenUngrantedEntry} onToggle={vi.fn()} />);
    const offering = screen.getByTestId(DATA_TEST_ID.TOGGLE).className;
    rerender(<AccessRow entry={givenImplementerEntry} onToggle={vi.fn()} />);
    const granted = screen.getByTestId(DATA_TEST_ID.TOGGLE).className;

    // THEN the offer tints with its own blue, not the accent green that *is* the granted look
    expect(offering).toContain("hover:bg-tabiya-blue/10");
    expect(offering).not.toContain("hover:bg-accent");
    // AND the granted one only lightens its green, rather than turning another colour
    expect(granted).toContain("hover:bg-tabiya-green/85");
  });

  it("should hand the whole entry back when the toggle is used", async () => {
    // GIVEN a row with a toggle handler
    const givenOnToggle = vi.fn();
    render(<AccessRow entry={givenUngrantedEntry} onToggle={givenOnToggle} />);

    // WHEN the funder grants access
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.TOGGLE));

    // THEN the handler is given the entry, which carries the user and the role they hold
    expect(givenOnToggle).toHaveBeenCalledExactlyOnceWith(givenUngrantedEntry);
  });

  it("should not accept another toggle while this row's change is in flight", async () => {
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
