import { describe, expect, it, vi } from "vitest";
import { render as rtlRender } from "@testing-library/react";
import { render as renderWithoutProviders } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { HashRouter } from "react-router-dom";
import { render, screen, waitFor } from "@/_test_utilities/test-utils";
import { server } from "@/mocks/server";
import { MODULE_IDS, Subject, Action, Can, AccessProvider, AccessGate, useAccess } from "@/access/AccessContext";
import { buildAbility } from "@/access/ability";
import { AuthContext, type AuthContextValue } from "@/auth/AuthContext";
import type { MeResponse } from "@/user/user.types";

const STUB_USER = { uid: "test-user", email: "test@example.com" } as AuthContextValue["user"];
const STUB_AUTH: AuthContextValue = { user: STUB_USER, loading: false, getIdToken: async () => "stub-token" };
const STUB_AUTH_LOGGED_OUT: AuthContextValue = {
  user: null,
  loading: false,
  getIdToken: async () => {
    throw new Error("not signed in");
  },
};

function renderWithAuth(ui: React.ReactElement, auth = STUB_AUTH) {
  return rtlRender(
    <AuthContext.Provider value={auth}>
      <HashRouter>{ui}</HashRouter>
    </AuthContext.Provider>
  );
}

function ScopeProbe() {
  const { activeModules, isMultiInstitution, name } = useAccess();
  return (
    <div>
      <span data-testid="active-modules">{activeModules.join(",")}</span>
      <span data-testid="is-multi-institution">{String(isMultiInstitution)}</span>
      <span data-testid="name">{name ?? "null"}</span>
    </div>
  );
}

function CanProbe() {
  return (
    <div>
      <Can I={Action.View} a={Subject.Dashboard}>
        <span data-testid="can-dashboard">yes</span>
      </Can>
      <Can I={Action.View} a={Subject.Institutions}>
        <span data-testid="can-institutions">yes</span>
      </Can>
      <Can I={Action.Manage} a={Subject.AccessManagement}>
        <span data-testid="can-access-management">yes</span>
      </Can>
    </div>
  );
}

describe("AccessProvider", () => {
  it("should deny all permissions and use default modules when no ability is provided", () => {
    // GIVEN no ability prop — default is deny-all
    render(
      <AccessProvider>
        <ScopeProbe />
        <CanProbe />
      </AccessProvider>
    );

    // THEN no permissions are granted, but default modules are present
    expect(screen.queryByTestId("can-dashboard")).not.toBeInTheDocument();
    expect(screen.getByTestId("active-modules")).toHaveTextContent(Object.values(MODULE_IDS).join(","));
  });

  it("should restrict Can renders to the permissions in the given ability", () => {
    // GIVEN an ability with only dashboard:view
    render(
      <AccessProvider ability={buildAbility(["dashboard:view"])}>
        <CanProbe />
      </AccessProvider>
    );

    // THEN dashboard is permitted, access-management is not
    expect(screen.getByTestId("can-dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("can-access-management")).not.toBeInTheDocument();
  });

  it("should expose only the given active modules", () => {
    // GIVEN two active modules
    render(
      <AccessProvider activeModules={[MODULE_IDS.BUILD_YOUR_PROFILE, MODULE_IDS.JOB_READINESS]}>
        <ScopeProbe />
      </AccessProvider>
    );

    expect(screen.getByTestId("active-modules")).toHaveTextContent("build-your-profile,job-readiness");
  });

  it("should report isMultiInstitution for an 'all' scope", () => {
    render(
      <AccessProvider scope={{ institutionIds: null }}>
        <ScopeProbe />
      </AccessProvider>
    );

    expect(screen.getByTestId("is-multi-institution")).toHaveTextContent("true");
  });

  it("should not report isMultiInstitution for a single-institution scope", () => {
    render(
      <AccessProvider scope={{ institutionIds: ["inst-1"] }}>
        <ScopeProbe />
      </AccessProvider>
    );

    expect(screen.getByTestId("is-multi-institution")).toHaveTextContent("false");
  });

  it("should default to no name when none is given", () => {
    render(
      <AccessProvider>
        <ScopeProbe />
      </AccessProvider>
    );

    expect(screen.getByTestId("name")).toHaveTextContent("null");
  });
});

describe("AccessGate", () => {
  const givenMe: MeResponse = {
    user_id: "u1",
    email: "u@example.com",
    name: "U",
    organization: "U Org",
    role: "implementer",
    permissions: ["dashboard:view", "institutions:view"],
    scope: { institution_ids: null },
    active_modules: ["build-your-profile"],
  };

  it("should show the loading state while /api/me is in flight", () => {
    server.use(http.get("/api/me", async () => new Promise(() => {})));

    renderWithAuth(
      <AccessGate>
        <CanProbe />
      </AccessGate>
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByTestId("can-dashboard")).not.toBeInTheDocument();
  });

  it("should hydrate the ability from /api/me permissions", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json(givenMe)));

    renderWithAuth(
      <AccessGate>
        <CanProbe />
      </AccessGate>
    );

    await waitFor(() => expect(screen.getByTestId("can-institutions")).toBeInTheDocument());
    expect(screen.getByTestId("can-dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("can-access-management")).not.toBeInTheDocument();
  });

  it("should hydrate the backend's name from /api/me, for screens with no client-side copy to prefer", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json(givenMe)));

    renderWithAuth(
      <AccessGate>
        <ScopeProbe />
      </AccessGate>
    );

    await waitFor(() => expect(screen.getByTestId("name")).toHaveTextContent("U"));
  });

  it("should show the unprovisioned message on a 404", async () => {
    server.use(http.get("/api/me", () => new HttpResponse(null, { status: 404 })));

    renderWithAuth(
      <AccessGate>
        <CanProbe />
      </AccessGate>
    );

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByTestId("can-dashboard")).not.toBeInTheDocument();
  });

  it("should show the error message when /api/me fails", async () => {
    server.use(http.get("/api/me", () => HttpResponse.error()));

    renderWithAuth(
      <AccessGate>
        <CanProbe />
      </AccessGate>
    );

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("should render children immediately when the user is not signed in", () => {
    // GIVEN no signed-in user (firebase resolved, user=null)
    renderWithAuth(
      <AccessGate>
        <CanProbe />
      </AccessGate>,
      STUB_AUTH_LOGGED_OUT
    );

    // THEN children render (with no permissions) so ProtectedRoute can redirect to login
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // Default ability grants nothing specific when no permissions are passed
    expect(screen.queryByTestId("can-dashboard")).not.toBeInTheDocument();
  });
});

describe("useAccess", () => {
  it("should throw when used outside an AccessProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderWithoutProviders(<ScopeProbe />)).toThrow("useAccess must be used within an AccessProvider.");
    consoleError.mockRestore();
  });
});
