import { describe, expect, it, vi } from "vitest";
import { render as renderWithoutProviders } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@/_test_utilities/test-utils";
import { server } from "@/mocks/server";
import { MODULE_IDS, Subject, Action, Can, AccessProvider, AccessGate, useAccess } from "@/access/AccessContext";
import { buildAbility } from "@/access/ability";
import type { MeResponse } from "@/user/user.types";

function ScopeProbe() {
  const { activeModules, isMultiInstitution } = useAccess();
  return (
    <div>
      <span data-testid="active-modules">{activeModules.join(",")}</span>
      <span data-testid="is-multi-institution">{String(isMultiInstitution)}</span>
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
  it("should grant all permissions and all modules by default", () => {
    // GIVEN no props
    render(
      <AccessProvider>
        <ScopeProbe />
        <CanProbe />
      </AccessProvider>
    );

    // THEN the default ability permits everything and all modules are active
    expect(screen.getByTestId("can-dashboard")).toBeInTheDocument();
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
      <AccessProvider scope={{ type: "all" }}>
        <ScopeProbe />
      </AccessProvider>
    );

    expect(screen.getByTestId("is-multi-institution")).toHaveTextContent("true");
  });

  it("should not report isMultiInstitution for a single-institution scope", () => {
    render(
      <AccessProvider scope={{ type: "institutions", institutionIds: ["inst-1"] }}>
        <ScopeProbe />
      </AccessProvider>
    );

    expect(screen.getByTestId("is-multi-institution")).toHaveTextContent("false");
  });
});

describe("AccessGate", () => {
  const givenMe: MeResponse = {
    user_id: "u1",
    email: "u@example.com",
    name: "U",
    permissions: ["dashboard:view", "institutions:view"],
    scope: { type: "all", institution_ids: [] },
    active_modules: ["build-your-profile"],
  };

  it("should show the loading state while /api/me is in flight", () => {
    server.use(http.get("/api/me", async () => new Promise(() => {})));

    render(
      <AccessGate>
        <CanProbe />
      </AccessGate>
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByTestId("can-dashboard")).not.toBeInTheDocument();
  });

  it("should hydrate the ability from /api/me permissions", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json(givenMe)));

    render(
      <AccessGate>
        <CanProbe />
      </AccessGate>
    );

    await waitFor(() => expect(screen.getByTestId("can-institutions")).toBeInTheDocument());
    expect(screen.getByTestId("can-dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("can-access-management")).not.toBeInTheDocument();
  });

  it("should show the unprovisioned message on a 404", async () => {
    server.use(http.get("/api/me", () => new HttpResponse(null, { status: 404 })));

    render(
      <AccessGate>
        <CanProbe />
      </AccessGate>
    );

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByTestId("can-dashboard")).not.toBeInTheDocument();
  });

  it("should show the error message when /api/me fails", async () => {
    server.use(http.get("/api/me", () => HttpResponse.error()));

    render(
      <AccessGate>
        <CanProbe />
      </AccessGate>
    );

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});

describe("useAccess", () => {
  it("should throw when used outside an AccessProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderWithoutProviders(<ScopeProbe />)).toThrow("useAccess must be used within an AccessProvider.");
    consoleError.mockRestore();
  });
});
