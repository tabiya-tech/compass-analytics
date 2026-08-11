import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/_test_utilities/test-utils";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DATA_TEST_ID as USER_AVATAR_TEST_ID } from "@/components/shared/UserAvatar";
import { SidebarUserMenu } from "./SidebarUserMenu";

function renderMenu() {
  const onSignOut = vi.fn();
  render(
    <SidebarProvider>
      <SidebarUserMenu onSignOut={onSignOut} />
    </SidebarProvider>
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

  it("should fall back to a generic person icon, with no photo on the signed-in user's profile", () => {
    // GIVEN the footer menu, for a user with no photoURL set
    // WHEN rendered
    renderMenu();

    // THEN the avatar falls back to a person icon
    expect(screen.getByTestId(USER_AVATAR_TEST_ID.FALLBACK).querySelector("svg")).toBeInTheDocument();
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
});
