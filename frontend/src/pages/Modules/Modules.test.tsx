import { describe, expect, it } from "vitest";
import { delay, http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { render, screen, userEvent, waitFor, within } from "@/_test_utilities/test-utils";
import { server } from "@/mocks/server";
import { AccessProvider, MODULE_IDS, type AccessScope, type ModuleId } from "@/access/AccessContext";
import { FiltersProvider } from "@/filters/FiltersContext";
import { createFixedModulesDateRange, createInitialFilters, type FiltersState } from "@/filters/filters";
import { MODULES_WITH_OWN_ENDPOINT } from "@/pages/Modules/hooks/use-module-metrics";
import { routerPaths } from "@/app/routerPaths";
import { DATA_TEST_ID as SCREEN_HEAD_TEST_ID } from "@/components/shared/ScreenHead";
import { DATA_TEST_ID as EMPTY_STATE_TEST_ID } from "@/components/shared/EmptyState";
import { DATA_TEST_ID as TIMELINE_TEST_ID } from "@/pages/Modules/components/ModuleTimeline";
import { DATA_TEST_ID as MODULE_BODY_TEST_ID } from "@/pages/Modules/components/ModuleBody";
import { MODULES_API_BASE } from "@/pages/Modules/services/ModuleMetrics.service";
import { formatDateRangeLabel } from "@/pages/Overview/utils";
import { Modules, DATA_TEST_ID } from "./Modules";

/** A fixed year-long window, so the mocked figures are stable. */
const GIVEN_FILTERS: FiltersState = {
  ...createInitialFilters(new Date(2026, 6, 7)),
  dateRange: { start: "2025-07-08", end: "2026-07-07" },
  granularity: "month",
};

const ONE_INSTITUTION: AccessScope = { type: "institutions", institutionIds: ["inst-1"] };
const WHOLE_SUITE: ModuleId[] = [
  MODULE_IDS.BUILD_YOUR_PROFILE,
  MODULE_IDS.JOB_READINESS,
  MODULE_IDS.CAREER_EXPLORER,
  MODULE_IDS.JOBS,
];

const MODULES_WITHOUT_THEIR_OWN_ENDPOINT: ModuleId[] = WHOLE_SUITE.filter(
  (moduleId) => !MODULES_WITH_OWN_ENDPOINT.includes(moduleId)
);

function renderModules(activeModules: readonly ModuleId[] = WHOLE_SUITE, scope: AccessScope = ONE_INSTITUTION) {
  return render(
    <AccessProvider scope={scope} activeModules={activeModules}>
      <FiltersProvider initialFilters={GIVEN_FILTERS}>
        <Modules />
      </FiltersProvider>
    </AccessProvider>
  );
}

/** Renders the screen as the router does for a link straight to one module. */
function renderModulesAt(moduleId: ModuleId, activeModules: readonly ModuleId[] = WHOLE_SUITE) {
  window.location.hash = `#/modules/${moduleId}`;
  return render(
    <AccessProvider scope={ONE_INSTITUTION} activeModules={activeModules}>
      <FiltersProvider initialFilters={GIVEN_FILTERS}>
        <Routes>
          <Route path={routerPaths.MODULE} element={<Modules />} />
        </Routes>
      </FiltersProvider>
    </AccessProvider>
  );
}

function stepFor(moduleId: ModuleId): HTMLElement {
  return screen.getAllByTestId(TIMELINE_TEST_ID.STEP).find((step) => step.dataset.module === moduleId)!;
}

function activeModuleOnScreen(): string | undefined {
  return screen.getAllByTestId(TIMELINE_TEST_ID.STEP).find((step) => step.dataset.active === "true")?.dataset.module;
}

describe("Modules screen", () => {
  it("should introduce the screen as a way into the deployment's modules", async () => {
    // GIVEN a deployment running the whole suite
    // WHEN the screen loads
    renderModules();

    // THEN it is headed as the modules screen, naming the rolling trailing year the figures cover
    expect(await screen.findByTestId(SCREEN_HEAD_TEST_ID.TITLE)).toHaveTextContent("Module-based analytics");
    expect(screen.getByTestId(SCREEN_HEAD_TEST_ID.EYEBROW)).toHaveTextContent("Modules");
    const expectedRange = formatDateRangeLabel(createFixedModulesDateRange());
    expect(screen.getByTestId(SCREEN_HEAD_TEST_ID.DESCRIPTION)).toHaveTextContent(expectedRange);
  });

  it("should show a body per deployed module, in the deployment's own order", async () => {
    // GIVEN a deployment running the whole suite
    // WHEN the screen loads
    renderModules();

    // THEN every module gets its own headed section, in that order
    await waitFor(() => expect(screen.getAllByTestId(DATA_TEST_ID.SECTION)).toHaveLength(4));
    expect(screen.getAllByTestId(DATA_TEST_ID.SECTION).map((section) => section.dataset.module)).toEqual([
      "build-your-profile",
      "job-readiness",
      "career-explorer",
      "jobs",
    ]);
  });

  it("should show only the modules a deployment actually runs", async () => {
    // GIVEN a deployment running Career Explorer and Jobs alone
    // WHEN the screen loads
    renderModules([MODULE_IDS.CAREER_EXPLORER, MODULE_IDS.JOBS]);

    // THEN it steps through those two, and nothing is shown for the rest
    await waitFor(() => expect(screen.getAllByTestId(DATA_TEST_ID.SECTION)).toHaveLength(2));
    expect(screen.getAllByTestId(TIMELINE_TEST_ID.STEP).map((step) => step.dataset.module)).toEqual([
      "career-explorer",
      "jobs",
    ]);
  });

  it("should say what share of jobseekers started each module, next to its step", async () => {
    // GIVEN Ndola Livelihoods Trust's engagement across the suite
    // WHEN the screen loads
    renderModules();

    // THEN each step carries that module's share of starters
    await waitFor(() => expect(screen.getAllByTestId(TIMELINE_TEST_ID.STEP)).toHaveLength(4));
    expect(within(stepFor(MODULE_IDS.BUILD_YOUR_PROFILE)).getByTestId(TIMELINE_TEST_ID.STEP_STARTED)).toHaveTextContent(
      "44% started"
    );
    // Jobs' own real endpoint doesn't report a started share (no aggregate endpoint to borrow one from).
    expect(within(stepFor(MODULE_IDS.JOBS)).getByTestId(TIMELINE_TEST_ID.STEP_STARTED)).toHaveTextContent("0% started");
  });

  it("should open at the module a link asked for, rather than at the top of the screen", async () => {
    // GIVEN a link straight to Career Explorer
    // WHEN the screen loads
    renderModulesAt(MODULE_IDS.CAREER_EXPLORER);

    // THEN that module's step is the one lit
    await waitFor(() => expect(activeModuleOnScreen()).toBe("career-explorer"));
  });

  it("should fall back to its first module when a link names one this deployment doesn't run", async () => {
    // GIVEN a link to Jobs, in a deployment that doesn't run Jobs
    // WHEN the screen loads
    renderModulesAt(MODULE_IDS.JOBS, [MODULE_IDS.BUILD_YOUR_PROFILE, MODULE_IDS.CAREER_EXPLORER]);

    // THEN it opens on the deployment's own first module instead of on nothing
    await waitFor(() => expect(screen.getAllByTestId(DATA_TEST_ID.SECTION)).toHaveLength(2));
    expect(activeModuleOnScreen()).toBe("build-your-profile");
  });

  it("should send a single-module deployment to Overview, where its module is shown instead", async () => {
    // GIVEN a deployment running Build Your Profile alone
    // WHEN someone opens the Modules screen anyway
    renderModules([MODULE_IDS.BUILD_YOUR_PROFILE]);

    // THEN there is no Modules screen for it — Overview carries that module
    await waitFor(() => expect(window.location.hash).toBe("#/"));
    expect(screen.queryByTestId(DATA_TEST_ID.CONTAINER)).not.toBeInTheDocument();
  });

  it("should show a placeholder while the first figures are on their way", () => {
    // GIVEN a deployment whose modules all depend on the aggregate mock, which hasn't answered yet
    server.use(http.get(`${MODULES_API_BASE}/metrics`, () => new Promise(() => {})));

    // WHEN the screen loads
    renderModules(MODULES_WITHOUT_THEIR_OWN_ENDPOINT);

    // THEN the screen is laid out but empty, rather than jumping into place later
    expect(screen.getByTestId(DATA_TEST_ID.LOADING)).toBeInTheDocument();
    expect(screen.queryByTestId(TIMELINE_TEST_ID.CONTAINER)).not.toBeInTheDocument();
  });

  it("should offer a retry when the figures could not be loaded at all", async () => {
    // GIVEN a deployment whose modules all depend on the aggregate mock, and it is failing
    server.use(http.get(`${MODULES_API_BASE}/metrics`, () => new HttpResponse(null, { status: 500 })));

    // WHEN the screen loads
    renderModules(MODULES_WITHOUT_THEIR_OWN_ENDPOINT);

    // THEN it says so and offers a way to try again
    expect(await screen.findByTestId(DATA_TEST_ID.ERROR)).toHaveTextContent("We couldn't load the module metrics.");
    expect(
      within(screen.getByTestId(EMPTY_STATE_TEST_ID.CONTAINER)).getByRole("button", { name: "Retry" })
    ).toBeVisible();
  });

  it("should reload the figures when the retry is taken", async () => {
    // GIVEN a first attempt that failed, for a deployment whose modules all depend on the aggregate mock
    server.use(http.get(`${MODULES_API_BASE}/metrics`, () => new HttpResponse(null, { status: 500 })));
    renderModules(MODULES_WITHOUT_THEIR_OWN_ENDPOINT);
    const actualRetry = await screen.findByRole("button", { name: "Retry" });

    // WHEN the endpoint recovers and the retry is taken
    server.resetHandlers();
    await userEvent.click(actualRetry);

    // THEN the figures arrive
    await waitFor(() => expect(screen.getAllByTestId(DATA_TEST_ID.SECTION)).toHaveLength(2));
  });

  it("should show a skeleton for Build Your Profile while its own endpoint is still loading, not the mock's fabricated numbers", async () => {
    // GIVEN Build Your Profile's real endpoint hasn't answered yet, while the rest load fine
    server.use(http.get(`${MODULES_API_BASE}/build-your-profile`, async () => await delay("infinite")));

    // WHEN the screen loads
    renderModules();

    // THEN the other three modules' figures are already up...
    await waitFor(() => expect(screen.getAllByTestId(DATA_TEST_ID.SECTION)).toHaveLength(4));
    // ...but Build Your Profile shows a loading skeleton, not the mock's own (fabricated) numbers
    expect(screen.getByTestId(MODULE_BODY_TEST_ID.LOADING)).toBeInTheDocument();
    expect(screen.queryByText("CVs generated")).not.toBeInTheDocument();
  });

  it("should say Build Your Profile's figures are unavailable, not show fabricated numbers, when its own endpoint fails", async () => {
    // GIVEN the rest of the deployment's figures load fine, but Build Your Profile's real endpoint fails
    server.use(http.get(`${MODULES_API_BASE}/build-your-profile`, () => new HttpResponse(null, { status: 500 })));

    // WHEN the screen loads
    renderModules();
    await waitFor(() => expect(screen.getAllByTestId(DATA_TEST_ID.SECTION)).toHaveLength(4));

    // THEN Build Your Profile says its figures are unavailable — not the mock's fabricated numbers.
    // findBy* waits for its own fetch to settle rather than assuming it already has by this point.
    expect(await screen.findByTestId(MODULE_BODY_TEST_ID.DEGRADED)).toHaveTextContent(
      "Build Your Profile figures aren't available right now"
    );
    // AND the rest of the page isn't told there's an error — only this one module's data failed
    expect(screen.queryByTestId(DATA_TEST_ID.ERROR)).not.toBeInTheDocument();
  });
});
