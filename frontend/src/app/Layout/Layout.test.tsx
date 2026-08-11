import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { AuthProvider } from "@/auth/AuthContext";
import { Action, Subject, useAbility } from "@/access/AccessContext";
import type { AppAbility } from "@/access/ability";
import { useFilters } from "@/filters/FiltersContext";
import { Layout } from "./Layout";
import type { MeResponse } from "@/user/user.types";

const givenMe: MeResponse = {
  user_id: "u1",
  email: "u@example.com",
  name: "U",
  permissions: ["dashboard:view", "institutions:view", "account:view"],
  scope: { type: "all", institution_ids: [] },
  active_modules: ["build-your-profile", "job-readiness", "career-explorer", "jobs"],
};

/** Reads both shared contexts, proving the shell supplies them to the outlet. */
function Screen() {
  const ability = useAbility<AppAbility>();
  const { filters } = useFilters();
  return (
    <div>
      <span data-testid="screen">Screen</span>
      <span data-testid="can-view-dashboard">{String(ability.can(Action.View, Subject.Dashboard))}</span>
      <span data-testid="granularity">{filters.granularity}</span>
    </div>
  );
}

// Raw RouterProvider wrapped in AuthProvider: Layout renders an <Outlet/> (two
// nested Routers aren't supported), and AccessGate needs an auth token to fetch
// /api/me. The gate resolves scope from /api/me, so the shell content appears
// once that request settles.
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
  it("should render the routed screen alongside the sidebar", async () => {
    // GIVEN the caller's profile resolves
    server.use(http.get("/api/me", () => HttpResponse.json(givenMe)));

    // WHEN the shell mounts
    renderLayout();

    // THEN the outlet content and the sidebar brand mark are both present
    await waitFor(() => expect(screen.getByTestId("screen")).toBeInTheDocument());
    expect(screen.getByAltText("Compass Analytics")).toBeInTheDocument();
  });

  it("should provide the access context to routed screens", async () => {
    // GIVEN the caller's profile resolves
    server.use(http.get("/api/me", () => HttpResponse.json(givenMe)));

    // WHEN the shell mounts
    renderLayout();

    // THEN a screen can read permissions without wiring its own provider
    await waitFor(() => expect(screen.getByTestId("can-view-dashboard")).toHaveTextContent("true"));
  });

  it("should provide the shared filter state to routed screens", async () => {
    // GIVEN the caller's profile resolves
    server.use(http.get("/api/me", () => HttpResponse.json(givenMe)));

    // WHEN the shell mounts
    renderLayout();

    // THEN a screen reads the shared filters without mounting its own provider
    await waitFor(() => expect(screen.getByTestId("granularity")).toHaveTextContent("day"));
  });

  it("should render the sidebar navigation with the current route marked active", async () => {
    // GIVEN the caller's profile resolves
    server.use(http.get("/api/me", () => HttpResponse.json(givenMe)));

    // WHEN the shell mounts at the root path
    renderLayout();

    // THEN the nav is present and Overview is the active item
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /^Overview$/ })).toHaveAttribute("data-active", "true")
    );
  });
});
