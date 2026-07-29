import { afterEach, describe, expect, it } from "vitest";
import { Briefcase, GraduationCap } from "lucide-react";
import { render, screen } from "@/_test_utilities/test-utils";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  AccessProvider,
  MODULE_IDS,
  PERMISSIONS,
  type AccessState,
  type ModuleId,
  type PermissionKey,
} from "@/access/AccessContext";
import { getModuleSubItems, getVisibleNavItems, NAV_ITEMS, SidebarNav, type NavVisibilityContext } from "./sidebar-nav";

function renderNav(access: Partial<AccessState> = {}) {
  return render(
    <AccessProvider access={access}>
      <SidebarProvider>
        <SidebarNav />
      </SidebarProvider>
    </AccessProvider>
  );
}

describe("SidebarNav", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("should render a hash-prefixed link per visible top-level nav item", () => {
    // GIVEN a full-access, all-modules-active state
    renderNav();

    // THEN each top-level item links to its hash-prefixed path
    expect(screen.getByRole("link", { name: /^Overview$/ })).toHaveAttribute("href", "#/");
    expect(screen.getByRole("link", { name: /Jobseekers/ })).toHaveAttribute("href", "#/jobseekers");
    expect(screen.getByRole("link", { name: /^Modules$/ })).toHaveAttribute("href", "#/modules");
  });

  it("should hide items the grant does not cover", () => {
    // GIVEN a minimal grant with no active modules
    renderNav({
      permissions: new Set([PERMISSIONS.DASHBOARD_VIEW]),
      activeModules: [],
    });

    // THEN the gated items are absent
    expect(screen.queryByRole("link", { name: /Jobseekers/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Modules$/ })).not.toBeInTheDocument();
  });

  it("should mark the current route as the active page", () => {
    // GIVEN the current location is /jobseekers
    window.location.hash = "#/jobseekers";

    // WHEN the nav renders
    renderNav();

    // THEN that link is marked as the current page
    expect(screen.getByRole("link", { name: /Jobseekers/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^Overview$/ })).not.toHaveAttribute("aria-current");
  });

  it("should highlight only the active submodule, not the Modules parent row, when on a submodule page", () => {
    // GIVEN the current location is a specific submodule page
    window.location.hash = "#/modules/jobs";

    // WHEN the nav renders
    renderNav();

    // THEN only the Jobs submodule is marked active — Modules itself is not
    expect(screen.getByRole("link", { name: "Jobs" })).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("link", { name: /^Modules$/ })).toHaveAttribute("data-active", "false");
  });

  it("should always list the active modules as Modules sub-items, with icons, no toggle required", () => {
    // GIVEN two active modules
    renderNav({ activeModules: [MODULE_IDS.JOB_READINESS, MODULE_IDS.JOBS] });

    // THEN only the active modules appear as sub-items, visible without any interaction
    expect(screen.getByRole("link", { name: "Job readiness" })).toHaveAttribute("href", "#/modules/job-readiness");
    expect(screen.getByRole("link", { name: "Jobs" })).toHaveAttribute("href", "#/modules/jobs");
    expect(screen.queryByRole("link", { name: "Career Explorer" })).not.toBeInTheDocument();
    // No collapse/expand affordance — Modules is a plain link like Overview/Jobseekers.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

function buildContext(overrides: { permissions?: PermissionKey[]; activeModules?: ModuleId[] }): NavVisibilityContext {
  const grantedPermissions = new Set(overrides.permissions ?? []);
  return {
    hasPermission: (permission) => grantedPermissions.has(permission),
    activeModules: overrides.activeModules ?? [],
  };
}

describe("getVisibleNavItems", () => {
  it("should show overview, jobseekers, and modules for a full-access grant with more than one active module", () => {
    // GIVEN a grant with every permission and two active modules
    const givenContext = buildContext({
      permissions: Object.values(PERMISSIONS),
      activeModules: [MODULE_IDS.BUILD_YOUR_PROFILE, MODULE_IDS.JOB_READINESS],
    });

    // WHEN computing the visible nav items
    const actual = getVisibleNavItems(NAV_ITEMS, givenContext).map((item) => item.id);

    // THEN all three items are visible
    expect(actual).toEqual(["overview", "jobseekers", "modules"]);
  });

  it("should hide jobseekers when jobseekers:view is not granted", () => {
    // GIVEN a grant missing jobseekers:view
    const givenContext = buildContext({
      permissions: [PERMISSIONS.DASHBOARD_VIEW],
      activeModules: [MODULE_IDS.BUILD_YOUR_PROFILE, MODULE_IDS.JOB_READINESS],
    });

    // WHEN computing the visible nav items
    const actual = getVisibleNavItems(NAV_ITEMS, givenContext).map((item) => item.id);

    // THEN jobseekers is absent, overview and modules remain
    expect(actual).toEqual(["overview", "modules"]);
  });

  it("should show only overview for a minimal grant with no active modules", () => {
    // GIVEN a minimal grant with no active modules
    const givenContext = buildContext({ permissions: [PERMISSIONS.DASHBOARD_VIEW] });

    // WHEN computing the visible nav items
    const actual = getVisibleNavItems(NAV_ITEMS, givenContext).map((item) => item.id);

    // THEN only overview is visible
    expect(actual).toEqual(["overview"]);
  });

  it.each([
    [0, false],
    [1, false],
    [2, true],
    [4, true],
  ] as const)(
    "should show Modules only when more than one module is active (%i active -> visible=%s)",
    (activeCount, expectedVisible) => {
      // GIVEN a full-permission grant with the given number of active modules
      const allModuleIds = Object.values(MODULE_IDS);
      const givenContext = buildContext({
        permissions: Object.values(PERMISSIONS),
        activeModules: allModuleIds.slice(0, activeCount),
      });

      // WHEN checking whether Modules is visible
      const actual = getVisibleNavItems(NAV_ITEMS, givenContext).some((item) => item.id === "modules");

      // THEN visibility matches the expectation
      expect(actual).toBe(expectedVisible);
    }
  );
});

describe("getModuleSubItems", () => {
  it("should map each active module to a sub-item with its label, path, and icon", () => {
    // GIVEN two active modules
    const givenActiveModules: ModuleId[] = [MODULE_IDS.JOB_READINESS, MODULE_IDS.JOBS];

    // WHEN computing the module sub-items
    const actual = getModuleSubItems(givenActiveModules);

    // THEN each maps to its label key, module path, and icon
    expect(actual).toEqual([
      {
        id: "job-readiness",
        labelKey: "nav.modulesSection.jobReadiness",
        path: "/modules/job-readiness",
        icon: GraduationCap,
      },
      { id: "jobs", labelKey: "nav.modulesSection.jobs", path: "/modules/jobs", icon: Briefcase },
    ]);
  });

  it("should return an empty list when no modules are active", () => {
    // GIVEN no active modules
    // WHEN computing the module sub-items
    const actual = getModuleSubItems([]);

    // THEN there are none
    expect(actual).toEqual([]);
  });
});
