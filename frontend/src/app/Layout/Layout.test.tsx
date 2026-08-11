import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { useAccess } from "@/access/AccessContext";
import { useFilters } from "@/filters/FiltersContext";
import { AuthProvider } from "@/auth/AuthContext";
import { Layout } from "./Layout";

/** Reads both shared contexts, proving the shell supplies them to the outlet. */
function Screen() {
  const { hasPermission } = useAccess();
  const { filters } = useFilters();
  return (
    <div>
      <span data-testid="screen">Screen</span>
      <span data-testid="can-view-dashboard">{String(hasPermission("dashboard:view"))}</span>
      <span data-testid="granularity">{filters.granularity}</span>
    </div>
  );
}

// Raw RouterProvider: Layout renders an <Outlet/>, and two nested Routers aren't supported.
// Layout's sidebar footer reads the signed-in user, same as the real boot chain in main.tsx.
function renderLayout() {
  const router = createMemoryRouter([
    { path: "/", element: <Layout />, children: [{ index: true, element: <Screen /> }] },
  ]);
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

describe("Layout", () => {
  it("should render the routed screen alongside the sidebar", () => {
    // GIVEN the app shell
    // WHEN it mounts
    renderLayout();

    // THEN the outlet content and the sidebar brand mark are both present
    expect(screen.getByTestId("screen")).toBeInTheDocument();
    expect(screen.getByAltText("Compass Analytics")).toBeInTheDocument();
  });

  it("should provide the access context to routed screens", () => {
    // GIVEN the app shell
    // WHEN it mounts
    renderLayout();

    // THEN a screen can read permissions without wiring its own provider
    expect(screen.getByTestId("can-view-dashboard")).toHaveTextContent("true");
  });

  it("should provide the shared filter state to routed screens", () => {
    // GIVEN the app shell
    // WHEN it mounts
    renderLayout();

    // THEN a screen reads the shared filters without mounting its own provider
    expect(screen.getByTestId("granularity")).toHaveTextContent("day");
  });

  it("should render the sidebar navigation with the current route marked active", () => {
    // GIVEN the app shell at the root path
    // WHEN it mounts
    renderLayout();

    // THEN the nav is present and Overview is the active item
    expect(screen.getByRole("link", { name: /^Overview$/ })).toHaveAttribute("data-active", "true");
  });
});
