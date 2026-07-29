import { describe, expect, it, vi } from "vitest";
import { render as renderWithoutProviders } from "@testing-library/react";
import { render, screen } from "@/_test_utilities/test-utils";
import { MODULE_IDS, PERMISSIONS } from "@/access/AccessContext";
import { AccessProvider, useAccess } from "./AccessContext";

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

describe("useAccess", () => {
  it("should throw when used outside an AccessProvider", () => {
    // GIVEN a component using useAccess with no provider above it
    // WHEN / THEN rendering it throws
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderWithoutProviders(<AccessProbe />)).toThrow("useAccess must be used within an AccessProvider.");
    consoleError.mockRestore();
  });
});
