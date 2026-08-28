import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/_test_utilities/test-utils";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DATA_TEST_ID as USER_AVATAR_TEST_ID } from "@/components/shared/UserAvatar";
import { AccessProvider } from "@/access/AccessContext";
import { Role } from "@/access/roles";
import { SidebarUserMenu } from "./SidebarUserMenu";

function renderMenu(role: Role | null = null) {
  const onSignOut = vi.fn();
  render(
    <AccessProvider role={role}>
      <SidebarProvider>
        <SidebarUserMenu onSignOut={onSignOut} />
      </SidebarProvider>
    </AccessProvider>
  );
  return { onSignOut };
}

describe("SidebarUserMenu", () => {
  it("should render a labelled trigger, falling back to the generic label with no display name set", () => {
    // GIVEN the footer menu, for a user with no display name set
    // WHEN rendered
    renderMenu();

    // THEN the trigger is reachable by its accessible name
    expect(screen.getByRole("button", { name: /Open account menu/ })).toBeInTheDocument();
    // AND it falls back to the generic label, since the `firebase/auth` test double has no displayName
    // (the avatar also carries its own sr-only copy of the name, so scope to the visible one)
    expect(screen.getByText("My account", { selector: ":not(.sr-only)" })).toBeInTheDocument();
  });

  it("should take the avatar's initials from whatever name the menu is showing", () => {
    // GIVEN a signed-in user with neither a photo nor a display name, so the menu shows "My account"
    // WHEN rendered
    renderMenu();

    // THEN the avatar takes its initials from that same label rather than showing a photo
    expect(screen.getByTestId(USER_AVATAR_TEST_ID.FALLBACK)).toHaveTextContent("MA");
  });

  it("should link Account settings to /settings and call onSignOut when Sign out is clicked", async () => {
    // GIVEN the menu is open
    const { onSignOut } = renderMenu();
    await userEvent.click(screen.getByRole("button", { name: /Open account menu/ }));

    // THEN Account settings links to /settings (role is "menuitem" — DropdownMenuItem sets it explicitly)
    expect(screen.getByRole("menuitem", { name: "Account settings" })).toHaveAttribute("href", "#/settings");

    // WHEN clicking Sign out
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));

    // THEN the sign-out callback fires
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("should name the role beneath the person's name", () => {
    // GIVEN a signed-in funder
    // WHEN rendered
    renderMenu(Role.Funder);

    // THEN the role sits under the name, in the same words the account screen uses for it
    expect(screen.getByText("Funder")).toBeInTheDocument();
  });

  it("should show a dash for the role when the caller's permissions add up to none this app knows", () => {
    // GIVEN a caller whose grants don't add up to a known role
    // WHEN rendered
    renderMenu(null);

    // THEN the role line says so rather than showing nothing
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
