import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, userEvent } from "@/_test_utilities/test-utils";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AccessProvider } from "@/access/AccessContext";
import { DATA_TEST_ID as TOGGLE_TEST_ID } from "@/components/sidebar/components/SidebarToggle";

/** Replaces the window's width with one a test can resize across the sidebar's breakpoint. */
function givenAWindowTooNarrowForAnExpandedSidebar(isNarrow: boolean) {
  let onViewportCrossedBreakpoint = (_: MediaQueryListEvent) => {};
  vi.stubGlobal("matchMedia", () => ({
    matches: isNarrow,
    addEventListener: (_: string, listener: typeof onViewportCrossedBreakpoint) =>
      (onViewportCrossedBreakpoint = listener),
    removeEventListener: () => {},
  }));

  return (becomesNarrow: boolean) =>
    act(() => onViewportCrossedBreakpoint({ matches: becomesNarrow } as MediaQueryListEvent));
}

const renderSidebar = (defaultOpen = true) =>
  render(
    <AccessProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
      </SidebarProvider>
    </AccessProvider>
  );

const sidebarState = () => document.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state");

describe("AppSidebar", () => {
  let defaultMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    defaultMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = defaultMatchMedia;
  });

  it("renders the Compass Analytics brand mark", () => {
    render(
      <AccessProvider>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </AccessProvider>
    );

    expect(screen.getByText("Compass Analytics")).toBeInTheDocument();
    expect(screen.getByAltText("Compass Analytics")).toBeInTheDocument();
  });

  it("should collapse to the icon rail when the toggle is clicked", async () => {
    // GIVEN the sidebar mounted expanded
    render(
      <AccessProvider>
        <SidebarProvider defaultOpen>
          <AppSidebar />
        </SidebarProvider>
      </AccessProvider>
    );

    // WHEN the user clicks the collapse control
    await userEvent.click(screen.getByTestId(TOGGLE_TEST_ID.BUTTON));

    // THEN the sidebar reports itself collapsed and the control offers to expand it again
    expect(document.querySelector('[data-slot="sidebar"]')).toHaveAttribute("data-state", "collapsed");
    expect(screen.getByTestId(TOGGLE_TEST_ID.BUTTON)).toHaveAccessibleName("Expand sidebar");
  });

  it("should start folded to icons when the window is too narrow to fit it expanded", () => {
    // GIVEN a window narrower than an expanded sidebar wants
    givenAWindowTooNarrowForAnExpandedSidebar(true);

    // WHEN the sidebar mounts
    renderSidebar();

    // THEN it stays on screen as the icon rail rather than crowding the content
    expect(sidebarState()).toBe("collapsed");
    expect(screen.getByTestId(TOGGLE_TEST_ID.BUTTON)).toBeInTheDocument();
  });

  it("should fold and unfold as the window is resized past the breakpoint", () => {
    // GIVEN a roomy window with the sidebar expanded
    const resizeWindow = givenAWindowTooNarrowForAnExpandedSidebar(false);
    renderSidebar();
    expect(sidebarState()).toBe("expanded");

    // WHEN the window is dragged narrower than the breakpoint
    resizeWindow(true);

    // THEN the sidebar folds itself to icons
    expect(sidebarState()).toBe("collapsed");

    // WHEN the window is widened again
    resizeWindow(false);

    // THEN it unfolds
    expect(sidebarState()).toBe("expanded");
  });
});
