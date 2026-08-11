import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, within } from "@/_test_utilities/test-utils";
import { server } from "@/mocks/server";
import { handlers } from "@/mocks/handlers";
import { buildOverviewMetrics } from "@/mocks/overview-metrics";
import { AccessProvider, type AccessState } from "@/access/AccessContext";
import { FiltersProvider } from "@/filters/FiltersContext";
import { createInitialFilters, type FiltersState } from "@/filters/filters";
import { formatNumber } from "@/components/charts/chart-scale";
import { DATA_TEST_ID as SCREEN_HEAD_TEST_ID } from "@/components/shared/ScreenHead";
import { DATA_TEST_ID as STAT_TILE_TEST_ID } from "@/components/shared/StatTile";
import { DATA_TEST_ID as EMPTY_STATE_TEST_ID } from "@/components/shared/EmptyState";
import { DATA_TEST_ID as REACH_PANEL_TEST_ID } from "@/pages/Overview/components/ReachOverTimePanel";
import { DATA_TEST_ID as LOGIN_PANEL_TEST_ID } from "@/pages/Overview/components/LoginMethodPanel";
import { DATA_TEST_ID as DEMOGRAPHICS_PANEL_TEST_ID } from "@/pages/Overview/components/DemographicsPanel";
import { OVERVIEW_API_BASE } from "@/pages/Overview/services/OverviewMetrics.service";
import { Overview, DATA_TEST_ID } from "./Overview";

/** A fixed year-long window, so the mocked figures and the header copy are stable. */
const GIVEN_WINDOW = { start: "2025-07-08", end: "2026-07-07" };
const GIVEN_FILTERS: FiltersState = {
  ...createInitialFilters(new Date(2026, 6, 7)),
  dateRange: GIVEN_WINDOW,
  granularity: "month",
};

const ONE_INSTITUTION: Partial<AccessState> = { scope: { type: "institutions", institutionIds: ["inst-1"] } };
const ALL_INSTITUTIONS: Partial<AccessState> = { scope: { type: "all" } };

function expectedMetricsFor(institutions: "all" | string[]) {
  return buildOverviewMetrics({ institutions, dateRange: GIVEN_WINDOW, granularity: "month" });
}

function renderOverview(access: Partial<AccessState> = ONE_INSTITUTION, filters: Partial<FiltersState> = {}) {
  return render(
    <AccessProvider access={access}>
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

    // THEN the head reads as a single deployment, naming it and the window
    expect(await screen.findByTestId(SCREEN_HEAD_TEST_ID.EYEBROW)).toHaveTextContent("Deployment overview");
    expect(screen.getByTestId(SCREEN_HEAD_TEST_ID.TITLE)).toHaveTextContent("Overview");
    expect(screen.getByTestId(SCREEN_HEAD_TEST_ID.DESCRIPTION)).toHaveTextContent(
      "Ndola Livelihoods Trust · Jul '25 – Jul '26"
    );
  });

  it("should count the institutions when the grant covers the whole deployment", async () => {
    // GIVEN a grant covering every institution
    // WHEN the screen loads
    renderOverview(ALL_INSTITUTIONS);

    // THEN the head reads as a portfolio, counting them rather than naming one
    expect(await screen.findByTestId(SCREEN_HEAD_TEST_ID.EYEBROW)).toHaveTextContent("Portfolio overview");
    expect(screen.getByTestId(SCREEN_HEAD_TEST_ID.DESCRIPTION)).toHaveTextContent("5 institutions · Jul '25 – Jul '26");
  });

  it("should name the institution being drilled into, out of a portfolio grant", async () => {
    // GIVEN a portfolio grant, drilled into one of its institutions
    // WHEN the screen loads
    renderOverview(ALL_INSTITUTIONS, { institutionDrillDownId: "inst-2" });

    // THEN the head reports on that institution alone
    expect(await screen.findByTestId(SCREEN_HEAD_TEST_ID.EYEBROW)).toHaveTextContent("Deployment overview");
    expect(screen.getByTestId(SCREEN_HEAD_TEST_ID.DESCRIPTION)).toHaveTextContent("Lusaka Youth Futures");
  });
});

describe("Overview screen stat tiles", () => {
  it("should show cumulative users, active users and average session length", async () => {
    // GIVEN the metrics for a single institution over the window
    const expectedMetrics = expectedMetricsFor(["inst-1"]);

    // WHEN the screen loads
    renderOverview(ONE_INSTITUTION);

    // THEN three tiles report the headline figures
    const actualTiles = await screen.findByTestId(DATA_TEST_ID.TILES);
    expect(within(actualTiles).getAllByTestId(STAT_TILE_TEST_ID.VALUE)).toHaveLength(3);

    const actualCumulativeUsers = within(screen.getByTestId(DATA_TEST_ID.CUMULATIVE_USERS_TILE));
    expect(actualCumulativeUsers.getByText("Cumulative users")).toBeInTheDocument();
    expect(actualCumulativeUsers.getByText(formatNumber(expectedMetrics.cumulativeUsers.total))).toBeInTheDocument();

    const actualActiveUsers = within(screen.getByTestId(DATA_TEST_ID.ACTIVE_USERS_TILE));
    expect(actualActiveUsers.getByText("Active users")).toBeInTheDocument();
    expect(actualActiveUsers.getByText(formatNumber(expectedMetrics.activeUsers.count))).toBeInTheDocument();
    expect(
      actualActiveUsers.getByText(
        `${expectedMetrics.activeUsers.shareOfUsersPercentage}% of users · last ${expectedMetrics.activeUsers.windowDays} days`
      )
    ).toBeInTheDocument();

    const actualSessionLength = within(screen.getByTestId(DATA_TEST_ID.SESSION_LENGTH_TILE));
    expect(actualSessionLength.getByText("Avg session length")).toBeInTheDocument();
    expect(actualSessionLength.getByText(`${expectedMetrics.averageSessionMinutes}m`)).toBeInTheDocument();
    expect(actualSessionLength.getByText("per login")).toBeInTheDocument();
  });

  it("should qualify the cumulative total with its growth and the bucket it is stated as of", async () => {
    // GIVEN the metrics for a single institution over the window
    const expectedMetrics = expectedMetricsFor(["inst-1"]);
    const expectedDirection = expectedMetrics.cumulativeUsers.growthPercentage < 0 ? "down" : "up";

    // WHEN the screen loads
    renderOverview(ONE_INSTITUTION);

    // THEN the tile carries the delta, in the direction the figures moved
    const actualTile = within(await screen.findByTestId(DATA_TEST_ID.CUMULATIVE_USERS_TILE));
    expect(actualTile.getByTestId(STAT_TILE_TEST_ID.TREND)).toHaveAttribute("data-direction", expectedDirection);
    // AND says which bucket the total is as of — the last month of the window
    expect(actualTile.getByText("as of Jul '26")).toBeInTheDocument();
  });

  it("should trace the cumulative total with a sparkline over the trailing window", async () => {
    // GIVEN cumulative users that only ever rise
    // WHEN the screen loads
    renderOverview(ONE_INSTITUTION);

    // THEN the tile carries a sparkline describing that rise
    const actualTile = within(await screen.findByTestId(DATA_TEST_ID.CUMULATIVE_USERS_TILE));
    const actualSparkline = within(actualTile.getByTestId(STAT_TILE_TEST_ID.SPARKLINE)).getByRole("img");
    expect(actualSparkline).toHaveAttribute("data-direction", "up");
    expect(actualSparkline).toHaveAccessibleName(/Cumulative users over the last 30 days/);
  });

  it("should aggregate the portfolio into figures larger than any one of its institutions", async () => {
    // GIVEN the same window read for one institution and for the whole portfolio
    const expectedInstitution = expectedMetricsFor(["inst-1"]);
    const expectedPortfolio = expectedMetricsFor("all");

    // WHEN the screen loads for the portfolio
    renderOverview(ALL_INSTITUTIONS);

    // THEN the total is the aggregate, not one institution's
    const actualTile = within(await screen.findByTestId(DATA_TEST_ID.CUMULATIVE_USERS_TILE));
    expect(actualTile.getByText(formatNumber(expectedPortfolio.cumulativeUsers.total))).toBeInTheDocument();
    expect(expectedPortfolio.cumulativeUsers.total).toBeGreaterThan(expectedInstitution.cumulativeUsers.total);
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
    // GIVEN the screen loaded over the default window
    renderOverview(ONE_INSTITUTION);
    const actualPanel = within(await screen.findByTestId(REACH_PANEL_TEST_ID.CONTAINER));
    expect(actualPanel.getByText("New and returning users, by month")).toBeInTheDocument();

    // WHEN the window is narrowed to a fortnight
    // (fireEvent, not userEvent.type — typing into <input type="date"> is locale/segment dependent)
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-06-25" } });

    // THEN the granularity re-derives, and the panel is bucketed by day
    expect(await screen.findByText("New and returning users, by day")).toBeInTheDocument();
  });
});

describe("Overview screen loading and failure", () => {
  it("should hold the screen's shape while the first response is in flight", () => {
    // GIVEN a request in flight
    server.use(http.get(`${OVERVIEW_API_BASE}/metrics`, async () => new Promise(() => {})));

    // WHEN the screen renders, before the response lands
    renderOverview(ONE_INSTITUTION);

    // THEN the layout is held by placeholders rather than collapsing
    expect(screen.getByTestId(DATA_TEST_ID.LOADING)).toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.TILES)).not.toBeInTheDocument();
  });

  it("should offer a retry when the metrics can't be loaded at all", async () => {
    // GIVEN the metrics endpoint is failing
    server.use(http.get(`${OVERVIEW_API_BASE}/metrics`, () => new HttpResponse(null, { status: 500 })));

    // WHEN the screen loads
    renderOverview(ONE_INSTITUTION);

    // THEN it says so, and offers a way to try again
    const actualError = await screen.findByTestId(DATA_TEST_ID.ERROR);
    expect(within(actualError).getByText("We couldn't load the dashboard metrics.")).toBeInTheDocument();
    expect(within(actualError).getByTestId(EMPTY_STATE_TEST_ID.ACTION_BUTTON)).toHaveTextContent("Retry");
  });

  it("should load the metrics on retry, once the endpoint recovers", async () => {
    // GIVEN a screen whose first load failed
    server.use(http.get(`${OVERVIEW_API_BASE}/metrics`, () => new HttpResponse(null, { status: 500 })));
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
