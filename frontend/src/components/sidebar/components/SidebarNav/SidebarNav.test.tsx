import { afterEach, describe, expect, it } from "vitest";
import { Briefcase, GraduationCap } from "lucide-react";
import { render, screen } from "@/_test_utilities/test-utils";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AccessProvider, Action, MODULE_IDS, Subject, type ModuleId } from "@/access/AccessContext";
import { buildAbility, type AppAbility } from "@/access/ability";
import { getModuleSubItems, getVisibleNavItems, NAV_ITEMS, SidebarNav } from "./SidebarNav";

function renderNav(props: { ability?: AppAbility; activeModules?: readonly ModuleId[] } = {}) {
  return render(
    <AccessProvider {...props}>
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
    expect(screen.getByRole("link", { name: /Institutions/ })).toHaveAttribute("href", "#/institutions");
    expect(screen.getByRole("link", { name: /Jobseekers/ })).toHaveAttribute("href", "#/jobseekers");
    expect(screen.getByRole("link", { name: /^Modules$/ })).toHaveAttribute("href", "#/modules");
  });

  it("should hide items the ability does not permit", () => {
    // GIVEN an ability with only dashboard:view and no active modules
    renderNav({ ability: buildAbility(["dashboard:view"]), activeModules: [] });

    // THEN the gated items are absent
    expect(screen.queryByRole("link", { name: /Institutions/ })).not.toBeInTheDocument();
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
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("getVisibleNavItems", () => {
  it("should show every item for a full-access grant with more than one active module", () => {
    // GIVEN an ability with every permission and two active modules
    const ability = buildAbility(["dashboard:view", "jobseekers:view", "institutions:view", "account:view"]);
    const activeModules: ModuleId[] = [MODULE_IDS.BUILD_YOUR_PROFILE, MODULE_IDS.JOB_READINESS];

    const actual = getVisibleNavItems(NAV_ITEMS, ability, activeModules).map((item) => item.id);

    expect(actual).toEqual(["overview", "jobseekers", "institutions", "modules"]);
  });

  it("should hide institutions when institutions:view is not granted", () => {
    // GIVEN an ability missing institutions:view
    const ability = buildAbility(["dashboard:view", "jobseekers:view"]);
    const activeModules: ModuleId[] = [MODULE_IDS.BUILD_YOUR_PROFILE, MODULE_IDS.JOB_READINESS];

    // WHEN computing the visible nav items
    const actual = getVisibleNavItems(NAV_ITEMS, ability, activeModules).map((item) => item.id);

    // THEN institutions is absent, the rest remain
    expect(actual).toEqual(["overview", "jobseekers", "modules"]);
  });

  it("should hide jobseekers when jobseekers:view is not granted", () => {
    // GIVEN an ability missing jobseekers:view
    const ability = buildAbility(["dashboard:view"]);
    const activeModules: ModuleId[] = [MODULE_IDS.BUILD_YOUR_PROFILE, MODULE_IDS.JOB_READINESS];

    const actual = getVisibleNavItems(NAV_ITEMS, ability, activeModules).map((item) => item.id);

    expect(actual).toEqual(["overview", "modules"]);
  });

  it("should show only overview for a minimal grant with no active modules", () => {
    const ability = buildAbility(["dashboard:view"]);

    const actual = getVisibleNavItems(NAV_ITEMS, ability, []).map((item) => item.id);

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
      const ability = buildAbility([`${Subject.Dashboard}:${Action.View}`, `${Subject.Jobseekers}:${Action.View}`]);
      const allModuleIds = Object.values(MODULE_IDS);

      const actual = getVisibleNavItems(NAV_ITEMS, ability, allModuleIds.slice(0, activeCount)).some(
        (item) => item.id === "modules"
      );

      expect(actual).toBe(expectedVisible);
    }
  );
});

describe("getModuleSubItems", () => {
  it("should map each active module to a sub-item with its label, path, and icon", () => {
    // GIVEN two active modules
    const givenActiveModules: ModuleId[] = [MODULE_IDS.JOB_READINESS, MODULE_IDS.JOBS];

    const actual = getModuleSubItems(givenActiveModules);

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
    expect(getModuleSubItems([])).toEqual([]);
  });
});
