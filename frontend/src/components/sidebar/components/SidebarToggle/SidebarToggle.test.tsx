import { describe, expect, it } from "vitest";
import { render, screen, userEvent } from "@/_test_utilities/test-utils";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { SidebarToggle, DATA_TEST_ID } from "./SidebarToggle";

function SidebarStateProbe() {
  const { state } = useSidebar();
  return <span data-testid="sidebar-state">{state}</span>;
}

function renderToggle(startsExpanded: boolean) {
  return render(
    <SidebarProvider defaultOpen={startsExpanded}>
      <SidebarToggle />
      <SidebarStateProbe />
    </SidebarProvider>
  );
}

describe("SidebarToggle", () => {
  it("should offer to collapse when the sidebar is expanded", () => {
    // GIVEN an expanded sidebar
    // WHEN the toggle renders
    renderToggle(true);

    // THEN it offers to collapse
    const button = screen.getByTestId(DATA_TEST_ID.BUTTON);
    expect(button).toHaveAccessibleName("Collapse sidebar");
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("should offer to expand when the sidebar is collapsed", () => {
    // GIVEN a collapsed sidebar
    // WHEN the toggle renders
    renderToggle(false);

    // THEN it offers to expand
    const button = screen.getByTestId(DATA_TEST_ID.BUTTON);
    expect(button).toHaveAccessibleName("Expand sidebar");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("should collapse and expand the sidebar as it is clicked", async () => {
    // GIVEN an expanded sidebar
    renderToggle(true);

    // WHEN the user clicks the toggle
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.BUTTON));

    // THEN the sidebar collapses
    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("collapsed");

    // WHEN the user clicks it again
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.BUTTON));

    // THEN the sidebar expands
    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");
  });

  it("should name the action on hover", async () => {
    // GIVEN an expanded sidebar
    renderToggle(true);

    // WHEN the user hovers the toggle
    await userEvent.hover(screen.getByTestId(DATA_TEST_ID.BUTTON));

    // THEN the tooltip names the action
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Collapse sidebar");
  });
});
