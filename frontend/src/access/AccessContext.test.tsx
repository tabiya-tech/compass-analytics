import { describe, expect, it, vi } from "vitest";
import { render as renderWithoutProviders } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@/_test_utilities/test-utils";
import { server } from "@/mocks/server";
import { MODULE_IDS, PERMISSIONS } from "@/access/AccessContext";
import { AccessGate, AccessProvider, useAccess } from "./AccessContext";
import type { MeResponse } from "@/user/user.types";

function AccessProbe() {
  const access = useAccess();
  return (
    <div>
      <span data-testid="has-institutions">{String(access.hasPermission("institutions:view"))}</span>
      <span data-testid="has-access-management">{String(access.hasPermission("access-management:manage"))}</span>
      <span data-testid="active-modules">{access.activeModules.join(",")}</span>
      <span data-testid="is-multi-institution">{String(access.isMultiInstitution)}</span>
    </div>
  );
}

describe("AccessProvider", () => {
  it("should serve the built-in grant when no access is passed", () => {
    // GIVEN no explicit access
    // WHEN rendered
    render(
      <AccessProvider>
        <AccessProbe />
      </AccessProvider>
    );

    // THEN the placeholder grant defined in code applies — every permission, every module
    expect(screen.getByTestId("has-institutions")).toHaveTextContent("true");
    expect(screen.getByTestId("active-modules")).toHaveTextContent(Object.values(MODULE_IDS).join(","));
  });

  it("should expose the permissions and active modules it is given", () => {
    // GIVEN a grant with two active modules
    const givenAccess = {
      activeModules: [MODULE_IDS.BUILD_YOUR_PROFILE, MODULE_IDS.JOB_READINESS],
    };

    // WHEN rendered
    render(
      <AccessProvider access={givenAccess}>
        <AccessProbe />
      </AccessProvider>
    );

    // THEN only those modules are active
    expect(screen.getByTestId("active-modules")).toHaveTextContent("build-your-profile,job-readiness");
  });

  it("should report false from hasPermission for a permission the grant excludes", () => {
    // GIVEN a grant without access-management:manage
    const givenAccess = { permissions: new Set([PERMISSIONS.DASHBOARD_VIEW]) };

    // WHEN rendered
    render(
      <AccessProvider access={givenAccess}>
        <AccessProbe />
      </AccessProvider>
    );

    // THEN that permission is not granted
    expect(screen.getByTestId("has-access-management")).toHaveTextContent("false");
  });

  it("should report isMultiInstitution for an 'all' scope", () => {
    // GIVEN a grant covering every institution
    render(
      <AccessProvider access={{ scope: { type: "all" } }}>
        <AccessProbe />
      </AccessProvider>
    );

    // THEN drilling down is meaningful
    expect(screen.getByTestId("is-multi-institution")).toHaveTextContent("true");
  });

  it("should not report isMultiInstitution for a single-institution scope", () => {
    // GIVEN a grant covering exactly one institution
    render(
      <AccessProvider access={{ scope: { type: "institutions", institutionIds: ["inst-1"] } }}>
        <AccessProbe />
      </AccessProvider>
    );

    // THEN drilling down would be a no-op
    expect(screen.getByTestId("is-multi-institution")).toHaveTextContent("false");
  });
});

describe("AccessGate", () => {
  const givenMe: MeResponse = {
    user_id: "u1",
    email: "u@example.com",
    name: "U",
    role: "funder",
    scope: { type: "all", institution_ids: [] },
    active_modules: ["build-your-profile"],
  };

  it("should show the loading state while /api/me is in flight", () => {
    // GIVEN /api/me has not yet responded
    server.use(http.get("/api/me", async () => new Promise(() => {})));

    // WHEN the gate is rendered
    render(
      <AccessGate>
        <AccessProbe />
      </AccessGate>
    );

    // THEN the loading status is shown and children are withheld
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByTestId("has-institutions")).not.toBeInTheDocument();
  });

  it("should hydrate access from /api/me and render children on success", async () => {
    // GIVEN /api/me returns a funder profile
    server.use(http.get("/api/me", () => HttpResponse.json(givenMe)));

    // WHEN the gate is rendered
    render(
      <AccessGate>
        <AccessProbe />
      </AccessGate>
    );

    // THEN the children eventually render with the funder's resolved access
    await waitFor(() => expect(screen.getByTestId("has-institutions")).toBeInTheDocument());
    expect(screen.getByTestId("has-institutions")).toHaveTextContent("true");
    expect(screen.getByTestId("active-modules")).toHaveTextContent("build-your-profile");
  });

  it("should show the unprovisioned message on a 404", async () => {
    // GIVEN the caller has no profile yet
    server.use(http.get("/api/me", () => new HttpResponse(null, { status: 404 })));

    // WHEN the gate is rendered
    render(
      <AccessGate>
        <AccessProbe />
      </AccessGate>
    );

    // THEN an alert is shown and children are withheld
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByTestId("has-institutions")).not.toBeInTheDocument();
  });

  it("should show the error message when /api/me fails", async () => {
    // GIVEN /api/me errors
    server.use(http.get("/api/me", () => HttpResponse.error()));

    // WHEN the gate is rendered
    render(
      <AccessGate>
        <AccessProbe />
      </AccessGate>
    );

    // THEN an alert is shown
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});

describe("useAccess", () => {
  it("should throw when used outside an AccessProvider", () => {
    // GIVEN a component using useAccess with no provider above it
    // WHEN / THEN rendering it throws
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderWithoutProviders(<AccessProbe />)).toThrow("useAccess must be used within an AccessProvider.");
    consoleError.mockRestore();
  });
});
