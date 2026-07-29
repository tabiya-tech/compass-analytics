import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/_test_utilities/test-utils";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarUserMenu } from "./sidebar-user-menu";

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
  it("should render a labelled trigger for the account menu", () => {
    // GIVEN the footer menu
    // WHEN rendered
    renderMenu();

    // THEN the trigger is reachable by its accessible name and shows a visible label
    expect(screen.getByRole("button", { name: /Open account menu/ })).toBeInTheDocument();
    expect(screen.getByText("My account")).toBeInTheDocument();
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
