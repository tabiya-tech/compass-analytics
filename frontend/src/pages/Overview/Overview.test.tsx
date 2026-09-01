import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { server } from "@/mocks/server";
import { handlers } from "@/mocks/handlers";
import { AccessProvider, MODULE_IDS, type AccessScope, type ModuleId } from "@/access/AccessContext";
import { FiltersProvider } from "@/filters/FiltersContext";
import { createInitialFilters, type FiltersState } from "@/filters/filters";
import { formatNumber } from "@/components/charts/chart-scale";
import { DATA_TEST_ID as SCREEN_HEAD_TEST_ID } from "@/components/shared/ScreenHead";
import { DATA_TEST_ID as STAT_TILE_TEST_ID } from "@/components/shared/StatTile";
import { DATA_TEST_ID as EMPTY_STATE_TEST_ID } from "@/components/shared/EmptyState";
import { DATA_TEST_ID as REACH_PANEL_TEST_ID } from "@/pages/Overview/components/ReachOverTimePanel";
import { DATA_TEST_ID as LOGIN_PANEL_TEST_ID } from "@/pages/Overview/components/LoginMethodPanel";
import { DATA_TEST_ID as DEMOGRAPHICS_PANEL_TEST_ID } from "@/pages/Overview/components/DemographicsPanel";
import { REACH_API_PATH } from "@/pages/Overview/services/OverviewMetrics.service";
import { Overview, DATA_TEST_ID } from "./Overview";

/** A fixed year-long window, so the mocked figures and the header copy are stable. */
const GIVEN_WINDOW = { start: "2025-07-08", end: "2026-07-07" };
const GIVEN_FILTERS: FiltersState = {
  ...createInitialFilters(new Date(2026, 6, 7)),
  dateRange: GIVEN_WINDOW,
  granularity: "month",
};

const ONE_INSTITUTION: AccessScope = { type: "institutions", institutionIds: ["inst-1"] };
const ALL_INSTITUTIONS: AccessScope = { type: "all" };

const WHOLE_SUITE: ModuleId[] = [
  MODULE_IDS.BUILD_YOUR_PROFILE,
  MODULE_IDS.JOB_READINESS,
  MODULE_IDS.CAREER_EXPLORER,
  MODULE_IDS.JOBS,
];

function renderOverview(
  scope: AccessScope = ONE_INSTITUTION,
  filters: Partial<FiltersState> = {},
  activeModules: readonly ModuleId[] = WHOLE_SUITE
) {
  return render(
    <AccessProvider scope={scope} activeModules={activeModules}>
      <FiltersProvider initialFilters={{ ...GIVEN_FILTERS, ...filters }}>
        <Overview />
      </FiltersProvider>
    </AccessProvider>
  );
}

describe("Overview screen header", () => {
  it("should name the institution when the grant covers only one", async () => {
    // GIVEN a grant covering a single institution
    // WHEN the screen loads
    renderOverview(ONE_INSTITUTION);

    // THEN the head reads as a single deployment
    expect(await screen.findByTestId(SCREEN_HEAD_TEST_ID.EYEBROW)).toHaveTextContent("Deployment overview");
    expect(screen.getByTestId(SCREEN_HEAD_TEST_ID.TITLE)).toHaveTextContent("Overview");
  });

  it("should say 'Portfolio overview' when the grant covers the whole deployment", async () => {
    // GIVEN a grant covering every institution
    // WHEN the screen loads
    renderOverview(ALL_INSTITUTIONS);

    // THEN the head reads as a portfolio
    expect(await screen.findByTestId(SCREEN_HEAD_TEST_ID.EYEBROW)).toHaveTextContent("Portfolio overview");
  });

  it("should read as a portfolio when the grant covers a named subset of the deployment", async () => {
    // GIVEN a grant covering two specific institutions
    const someInstitutions: AccessScope = { type: "institutions", institutionIds: ["inst-1", "inst-2"] };

    // WHEN the screen loads
    renderOverview(someInstitutions);

    // THEN the head reads as a portfolio
    expect(await screen.findByTestId(SCREEN_HEAD_TEST_ID.EYEBROW)).toHaveTextContent("Portfolio overview");
  });
});

describe("Overview screen stat tiles", () => {
  it("should show cumulative users, active users and average session length from the reach endpoint", async () => {
    // GIVEN the reach endpoint returns its stub (set up by the default MSW handlers)
    // WHEN the screen loads
    renderOverview(ONE_INSTITUTION);

    // THEN three tiles are rendered with the figures from the reach summary
    const actualTiles = await screen.findByTestId(DATA_TEST_ID.TILES);
    expect(within(actualTiles).getAllByTestId(STAT_TILE_TEST_ID.VALUE)).toHaveLength(3);

    expect(
      within(screen.getByTestId(DATA_TEST_ID.CUMULATIVE_USERS_TILE)).getByText("Cumulative users")
    ).toBeInTheDocument();
    expect(within(screen.getByTestId(DATA_TEST_ID.ACTIVE_USERS_TILE)).getByText("Active users")).toBeInTheDocument();
    expect(
      within(screen.getByTestId(DATA_TEST_ID.SESSION_LENGTH_TILE)).getByText("Avg session length")
    ).toBeInTheDocument();
  });

  it("should display the cumulative total from the reach summary", async () => {
    // GIVEN the reach endpoint returns 12 450 total users (the stub value)
    renderOverview(ONE_INSTITUTION);

    // THEN the cumulative users tile shows that figure
    const actualTile = within(await screen.findByTestId(DATA_TEST_ID.CUMULATIVE_USERS_TILE));
    expect(actualTile.getByText(formatNumber(12_450))).toBeInTheDocument();
  });

  it("should qualify the cumulative total with its growth and the bucket it is stated as of", async () => {
    // GIVEN the screen loads with the default reach stub
    renderOverview(ONE_INSTITUTION);

    // THEN the tile carries a trend indicator and a period label from the last series bucket
    const actualTile = within(await screen.findByTestId(DATA_TEST_ID.CUMULATIVE_USERS_TILE));
    expect(actualTile.getByTestId(STAT_TILE_TEST_ID.TREND)).toBeInTheDocument();
    expect(actualTile.getByText(/as of/)).toBeInTheDocument();
  });

  it("should trace the cumulative total with a sparkline", async () => {
    // GIVEN the screen loads
    renderOverview(ONE_INSTITUTION);

    // THEN the tile carries a sparkline
    const actualTile = within(await screen.findByTestId(DATA_TEST_ID.CUMULATIVE_USERS_TILE));
    expect(actualTile.getByTestId(STAT_TILE_TEST_ID.SPARKLINE)).toBeInTheDocument();
  });
});

describe("Overview screen panels", () => {
  it("should render the reach, login-method and demographics panels", async () => {
    // GIVEN a grant covering a single institution
    // WHEN the screen loads
    renderOverview(ONE_INSTITUTION);

    // THEN all three panels are on the screen
    expect(await screen.findByTestId(REACH_PANEL_TEST_ID.CONTAINER)).toBeInTheDocument();
    expect(screen.getByTestId(LOGIN_PANEL_TEST_ID.CONTAINER)).toBeInTheDocument();
    expect(screen.getByTestId(DEMOGRAPHICS_PANEL_TEST_ID.CONTAINER)).toBeInTheDocument();
  });

  it("should bucket the reach panel by the granularity the window implies", async () => {
    // GIVEN a six-week window, which is read by week
    // WHEN the screen loads
    renderOverview(ONE_INSTITUTION, { dateRange: { start: "2026-05-01", end: "2026-06-12" }, granularity: "week" });

    // THEN the reach panel says it is bucketed weekly
    const actualPanel = within(await screen.findByTestId(REACH_PANEL_TEST_ID.CONTAINER));
    expect(actualPanel.getByText("New and returning users, by week")).toBeInTheDocument();
  });

  it("should refetch against the new window when the reach panel's time filter moves", async () => {
    // GIVEN the screen loaded over the default window (start Jul 8 2025, defaultMonth for the calendar)
    renderOverview(ONE_INSTITUTION);
    const actualPanel = within(await screen.findByTestId(REACH_PANEL_TEST_ID.CONTAINER));
    expect(actualPanel.getByText("New and returning users, by month")).toBeInTheDocument();
    const user = userEvent.setup();

    // WHEN the window is narrowed to a fortnight, picked from the panel's own calendar
    await user.click(screen.getByRole("button", { name: "Date range" }));
    const newStart = new Date(2025, 6, 8);
    const newEnd = new Date(2025, 6, 22);
    await user.click(document.querySelector<HTMLButtonElement>(`[data-day="${newStart.toLocaleDateString()}"]`)!);
    await user.click(document.querySelector<HTMLButtonElement>(`[data-day="${newEnd.toLocaleDateString()}"]`)!);

    // THEN the granularity re-derives, and the panel is bucketed by day
    expect(await screen.findByText("New and returning users, by day")).toBeInTheDocument();
  });
});

describe("Overview screen loading and failure", () => {
  it("should hold the screen's shape while the first response is in flight", () => {
    // GIVEN a request in flight
    server.use(http.get(REACH_API_PATH, async () => new Promise(() => {})));

    // WHEN the screen renders, before the response lands
    renderOverview(ONE_INSTITUTION);

    // THEN the layout is held by placeholders rather than collapsing
    expect(screen.getByTestId(DATA_TEST_ID.LOADING)).toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.TILES)).not.toBeInTheDocument();
  });

  it("should offer a retry when the metrics can't be loaded at all", async () => {
    // GIVEN the reach endpoint is failing
    server.use(http.get(REACH_API_PATH, () => new HttpResponse(null, { status: 500 })));

    // WHEN the screen loads
    renderOverview(ONE_INSTITUTION);

    // THEN it says so, and offers a way to try again
    const actualError = await screen.findByTestId(DATA_TEST_ID.ERROR);
    expect(within(actualError).getByText("We couldn't load the dashboard metrics.")).toBeInTheDocument();
    expect(within(actualError).getByTestId(EMPTY_STATE_TEST_ID.ACTION_BUTTON)).toHaveTextContent("Retry");
  });

  it("should load the metrics on retry, once the endpoint recovers", async () => {
    // GIVEN a screen whose first load failed
    server.use(http.get(REACH_API_PATH, () => new HttpResponse(null, { status: 500 })));
    renderOverview(ONE_INSTITUTION);
    const actualError = await screen.findByTestId(DATA_TEST_ID.ERROR);

    // WHEN the endpoint recovers and the reader retries
    server.use(...handlers);
    await userEvent.click(within(actualError).getByTestId(EMPTY_STATE_TEST_ID.ACTION_BUTTON));

    // THEN the figures arrive and the error state is gone
    expect(await screen.findByTestId(DATA_TEST_ID.TILES)).toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.ERROR)).not.toBeInTheDocument();
  });
});

/**
 * Where a deployment's module analytics live is one branch, shared with the
 * Modules screen: one module renders here, several get a screen of their own.
 */
describe("Overview screen, for a deployment running a single module", () => {
  it("should carry that module's own figures, since there is no Modules screen for it", async () => {
    // GIVEN a deployment running Build Your Profile alone
    // WHEN the screen loads
    renderOverview(ONE_INSTITUTION, {}, [MODULE_IDS.BUILD_YOUR_PROFILE]);

    // THEN the module's figures are part of this screen, headed by its own question
    const actualSection = await screen.findByTestId(DATA_TEST_ID.INLINE_MODULE);
    expect(actualSection).toHaveAttribute("data-module", "build-your-profile");
    expect(screen.getByRole("heading", { level: 2, name: "Are people building their profiles?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Conversation funnel" })).toBeInTheDocument();
  });

  it("should leave the module analytics to the Modules screen when several are deployed", async () => {
    // GIVEN a deployment running the whole suite
    // WHEN the screen loads
    renderOverview(ONE_INSTITUTION, {}, WHOLE_SUITE);

    // THEN Overview reports reach and demographics only — the modules have a screen of their own
    expect(await screen.findByTestId(DATA_TEST_ID.TILES)).toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.INLINE_MODULE)).not.toBeInTheDocument();
  });
});
