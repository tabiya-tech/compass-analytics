import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@/_test_utilities/test-utils";
import { FiltersProvider } from "@/filters/FiltersContext";
import { createInitialFilters, type FiltersState, type Granularity } from "@/filters/filters";
import { DATA_TEST_ID as BAR_CHART_TEST_ID } from "@/components/charts/BarChart";
import { DATA_TEST_ID as TABLE_TEST_ID } from "@/components/charts/components/ChartDataTable";
import type { ReachPoint } from "@/pages/Overview/overview.types";
import { ReachOverTimePanel } from "./ReachOverTimePanel";

/** Every stacked segment is a `<path class="recharts-rectangle">`, whatever the bar's width or radius. */
function renderedBars(container: HTMLElement): SVGPathElement[] {
  return [...container.querySelectorAll<SVGPathElement>(".recharts-rectangle")];
}

const GIVEN_TODAY = new Date(2026, 6, 7);

const GIVEN_MONTHLY_REACH: ReachPoint[] = [
  { period: "2025-07", newUsers: 155, returningUsers: 63 },
  { period: "2025-08", newUsers: 96, returningUsers: 41 },
  { period: "2025-09", newUsers: 160, returningUsers: 66 },
];

function renderPanel(
  props: Partial<{ reachSeries: readonly ReachPoint[]; granularity: Granularity; isLoading: boolean }> = {},
  filters: Partial<FiltersState> = {}
) {
  const initialFilters: FiltersState = { ...createInitialFilters(GIVEN_TODAY), ...filters };
  return render(
    <FiltersProvider initialFilters={initialFilters}>
      <ReachOverTimePanel reachSeries={GIVEN_MONTHLY_REACH} granularity="month" {...props} />
    </FiltersProvider>
  );
}

describe("ReachOverTimePanel", () => {
  it("should title the panel and say how the series is bucketed", () => {
    // GIVEN a monthly reach series
    // WHEN the panel is rendered
    renderPanel();

    // THEN it is titled, and the description names the bucket size
    expect(screen.getByRole("heading", { level: 2, name: "Reach over time" })).toBeInTheDocument();
    expect(screen.getByText("New and returning users, by month")).toBeInTheDocument();
  });

  it("should stack new users under returning users, one column per bucket", () => {
    // GIVEN a series of three monthly buckets
    // WHEN the panel is rendered
    const { container } = renderPanel();

    // THEN both series are drawn for every bucket — one stacked segment each
    expect(renderedBars(container)).toHaveLength(GIVEN_MONTHLY_REACH.length * 2);
  });

  it("should label each column with its period and carry both series in the data table", () => {
    // GIVEN a series starting in July 2025
    // WHEN the panel is rendered
    renderPanel();

    // THEN the buckets are labelled as months
    const actualTable = within(screen.getByTestId(TABLE_TEST_ID.TABLE));
    expect(actualTable.getByRole("rowheader", { name: "Jul '25" })).toBeInTheDocument();
    // AND the table names both series, so the figures are readable without the chart
    expect(actualTable.getByRole("columnheader", { name: "New" })).toBeInTheDocument();
    expect(actualTable.getByRole("columnheader", { name: "Returning" })).toBeInTheDocument();
    expect(actualTable.getByRole("cell", { name: "155" })).toBeInTheDocument();
  });

  it("should label the buckets by day when the series is read by day", () => {
    // GIVEN a daily series
    const givenDailyReach: ReachPoint[] = [
      { period: "2026-06-01", newUsers: 12, returningUsers: 4 },
      { period: "2026-06-02", newUsers: 18, returningUsers: 7 },
    ];

    // WHEN the panel is rendered at day granularity
    renderPanel({ reachSeries: givenDailyReach, granularity: "day" });

    // THEN the description and the bucket labels both read as days
    expect(screen.getByText("New and returning users, by day")).toBeInTheDocument();
    const actualTable = within(screen.getByTestId(TABLE_TEST_ID.TABLE));
    expect(actualTable.getByRole("rowheader", { name: "1 Jun" })).toBeInTheDocument();
  });

  it("should let the reader change the window from inside the panel", () => {
    // GIVEN the panel is showing the default window
    renderPanel();

    // WHEN a new start date is picked in the panel's own time filter
    // (fireEvent, not userEvent.type — typing into <input type="date"> is locale/segment dependent)
    const actualStartInput = screen.getByLabelText("Start date");
    fireEvent.change(actualStartInput, { target: { value: "2026-06-01" } });

    // THEN the shared filter state has moved with it
    expect(actualStartInput).toHaveValue("2026-06-01");
  });

  it("should mark the placeholder as loading rather than claim there is no data, while the first response is in flight", () => {
    // GIVEN no series yet, and a request in flight
    // WHEN the panel is rendered
    renderPanel({ reachSeries: [], isLoading: true });

    // THEN the placeholder is announced as loading
    expect(screen.getByTestId(BAR_CHART_TEST_ID.EMPTY)).toHaveAccessibleName("Loading…");
  });

  it("should show a greyed-out placeholder with a short label when the window holds no data", () => {
    // GIVEN a window with no buckets in it
    // WHEN the panel is rendered
    renderPanel({ reachSeries: [] });

    // THEN the placeholder is labelled so it doesn't read as still loading
    expect(screen.getByTestId(BAR_CHART_TEST_ID.EMPTY)).toHaveTextContent("No data to show for this selection.");
  });
});
