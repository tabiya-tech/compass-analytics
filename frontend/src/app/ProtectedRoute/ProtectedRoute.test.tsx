import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthContext";
import { AccessProvider, PERMISSIONS, type PermissionKey } from "@/access/AccessContext";
import { routerPaths } from "@/app/routerPaths";
import ProtectedRoute from "./ProtectedRoute";

/** Renders the guarded route in a real router, so a redirect shows up as another screen. */
function renderAt(path: string, grantedPermissions: PermissionKey[]) {
  const router = createMemoryRouter(
    [
      { path: routerPaths.ROOT, element: <span data-testid="overview-screen">Overview</span> },
      { path: routerPaths.LOGIN, element: <span data-testid="login-screen">Login</span> },
      {
        path: routerPaths.INSTITUTIONS,
        element: (
          <ProtectedRoute permission={PERMISSIONS.INSTITUTIONS_VIEW}>
            <span data-testid="institutions-screen">Institutions</span>
          </ProtectedRoute>
        ),
      },
    ],
    { initialEntries: [path] }
  );

  return render(
    <AuthProvider>
      <AccessProvider access={{ permissions: new Set(grantedPermissions) }}>
        <RouterProvider router={router} />
      </AccessProvider>
    </AuthProvider>
  );
}

describe("ProtectedRoute", () => {
  it("should render the screen when the grant includes the permission it requires", async () => {
    // GIVEN a signed-in user whose grant covers institutions:view
    // WHEN they open the institutions screen
    renderAt(routerPaths.INSTITUTIONS, [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.INSTITUTIONS_VIEW]);

    // THEN the screen is shown
    await waitFor(() => expect(screen.getByTestId("institutions-screen")).toBeInTheDocument());
  });

  it("should send a user whose grant misses the permission back to the dashboard, deep links included", async () => {
    // GIVEN a signed-in user whose grant does not cover institutions:view
    // WHEN they deep-link straight into the institutions screen
    renderAt(routerPaths.INSTITUTIONS, [PERMISSIONS.DASHBOARD_VIEW]);

    // THEN they never reach it, and land on the dashboard instead
    await waitFor(() => expect(screen.getByTestId("overview-screen")).toBeInTheDocument());
    expect(screen.queryByTestId("institutions-screen")).not.toBeInTheDocument();
  });

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
        <AccessProvider access={{ permissions: new Set<PermissionKey>() }}>
          <RouterProvider router={router} />
        </AccessProvider>
      </AuthProvider>
    );

    // THEN the screen is shown
    await waitFor(() => expect(screen.getByTestId("overview-screen")).toBeInTheDocument());
  });
});
