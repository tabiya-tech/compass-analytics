import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthContext";
import { AccessProvider, Action, Subject } from "@/access/AccessContext";
import { buildAbility } from "@/access/ability";
import { routerPaths } from "@/app/routerPaths";
import ProtectedRoute, { PermissionRoute } from "./ProtectedRoute";

/** Renders the guarded route in a real router, so a redirect shows up as another screen. */
function renderAt(path: string, permissions: string[]) {
  const router = createMemoryRouter(
    [
      { path: routerPaths.ROOT, element: <span data-testid="overview-screen">Overview</span> },
      { path: routerPaths.LOGIN, element: <span data-testid="login-screen">Login</span> },
      {
        path: routerPaths.INSTITUTIONS,
        element: (
          <PermissionRoute action={Action.View} subject={Subject.Institutions}>
            <span data-testid="institutions-screen">Institutions</span>
          </PermissionRoute>
        ),
      },
    ],
    { initialEntries: [path] }
  );

  return render(
    <AuthProvider>
      <AccessProvider ability={buildAbility(permissions)}>
        <RouterProvider router={router} />
      </AccessProvider>
    </AuthProvider>
  );
}

describe("PermissionRoute", () => {
  it("should render the screen when the grant includes the permission it requires", async () => {
    // GIVEN a signed-in user whose grant covers institutions:view
    // WHEN they open the institutions screen
    renderAt(routerPaths.INSTITUTIONS, ["dashboard:view", "institutions:view"]);

    // THEN the screen is shown
    await waitFor(() => expect(screen.getByTestId("institutions-screen")).toBeInTheDocument());
  });

  it("should show a forbidden message when the grant misses the required permission", async () => {
    // GIVEN a signed-in user whose grant does not cover institutions:view
    // WHEN they navigate to the institutions screen
    renderAt(routerPaths.INSTITUTIONS, ["dashboard:view"]);

    // THEN they see a forbidden message, not the screen
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByTestId("institutions-screen")).not.toBeInTheDocument();
  });
});

describe("ProtectedRoute", () => {
  it("should render an ungated screen for any signed-in user", async () => {
    // GIVEN a signed-in user with a minimal grant
    const router = createMemoryRouter([
      {
        path: routerPaths.ROOT,
        element: (
          <ProtectedRoute>
            <span data-testid="overview-screen">Overview</span>
          </ProtectedRoute>
        ),
      },
    ]);

    // WHEN they open a route that requires no particular permission
    render(
      <AuthProvider>
        <AccessProvider ability={buildAbility([])}>
          <RouterProvider router={router} />
        </AccessProvider>
      </AuthProvider>
    );

    // THEN the screen is shown
    await waitFor(() => expect(screen.getByTestId("overview-screen")).toBeInTheDocument());
  });
});
