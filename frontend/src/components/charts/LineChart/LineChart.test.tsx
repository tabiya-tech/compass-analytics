import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { LineChart, DATA_TEST_ID, type LineChartSeries } from "./LineChart";

const LABEL = "Active users by month";

const ACTIVE_USERS: LineChartSeries = {
  id: "active",
  label: "Active users",
  points: [
    { label: "Jul", value: 180 },
    { label: "Aug", value: 240 },
    { label: "Sep", value: 320 },
  ],
};

const CONVERSATIONS: LineChartSeries = {
  id: "conversations",
  label: "Conversations",
  points: [
    { label: "Jul", value: 90 },
    { label: "Aug", value: 140 },
    { label: "Sep", value: 210 },
  ],
};

/** Recharts wraps every `<Area>` series in this layer, whatever its fill. */
function renderedAreas(container: HTMLElement): Element[] {
  return [...container.querySelectorAll(".recharts-layer.recharts-area")];
}

/** The washed-in area fill is this path; an unfilled series still gets one, just at zero opacity. */
function areaFillOpacity(area: Element): string | null {
  return area.querySelector(".recharts-area-area")?.getAttribute("fill-opacity") ?? null;
}

/** Recharts wraps its legend in this class whenever one is rendered, whatever the content. */
function legend(container: HTMLElement): HTMLElement | null {
  return container.querySelector(".recharts-legend-wrapper");
}

describe("LineChart", () => {
  it("should draw one line per series", () => {
    // GIVEN two series over the same months
    // WHEN they are rendered
    const { container } = render(<LineChart label={LABEL} series={[ACTIVE_USERS, CONVERSATIONS]} />);

    // THEN each gets its own area/line layer
    expect(renderedAreas(container)).toHaveLength(2);
  });

  it("should wash the area under each line only when asked", () => {
    // GIVEN a series rendered without a fill
    const { container, unmount } = render(<LineChart label={LABEL} series={[ACTIVE_USERS]} />);

    // THEN the fill is present but fully transparent
    const [unfilled] = renderedAreas(container);
    expect(areaFillOpacity(unfilled)).toBe("0");
    unmount();

    // WHEN the same series is rendered filled
    const { container: filledContainer } = render(<LineChart label={LABEL} series={[ACTIVE_USERS]} filled />);

    // THEN the area is washed in under it
    const [filled] = renderedAreas(filledContainer);
    expect(areaFillOpacity(filled)).toBe("0.1");
  });

  it("should show a legend only once there is more than one series to tell apart", () => {
    // GIVEN a lone series, which the chart's own title already names
    const { container, unmount } = render(<LineChart label={LABEL} series={[ACTIVE_USERS]} />);

    // THEN a legend would only restate the title, so there isn't one
    expect(legend(container)).not.toBeInTheDocument();
    unmount();

    // WHEN a second series is added
    const { container: withLegend } = render(<LineChart label={LABEL} series={[ACTIVE_USERS, CONVERSATIONS]} />);

    // THEN identity stops depending on colour alone and the legend appears
    const actualLegend = within(legend(withLegend)!);
    expect(actualLegend.getByText("Active users")).toBeInTheDocument();
    expect(actualLegend.getByText("Conversations")).toBeInTheDocument();
  });

  it("should keep every plotted value reachable in the data table", () => {
    // GIVEN two series whose values are only otherwise shown on hover
    // WHEN they are rendered
    render(<LineChart label={LABEL} series={[ACTIVE_USERS, CONVERSATIONS]} />);

    // THEN the numbers are all in the table, row by period
    const actualTable = within(screen.getByRole("table", { name: LABEL }));
    expect(actualTable.getByRole("columnheader", { name: "Period" })).toBeInTheDocument();
    expect(actualTable.getByRole("rowheader", { name: "Sep" })).toBeInTheDocument();
    expect(actualTable.getByRole("cell", { name: "320" })).toBeInTheDocument();
    expect(actualTable.getByRole("cell", { name: "210" })).toBeInTheDocument();
  });

  it("should use a custom category label for the table's first column when given one", () => {
    // GIVEN a caller with its own name for the x-axis category
    // WHEN it is rendered
    render(<LineChart label={LABEL} series={[ACTIVE_USERS]} categoryLabel="Quarter" />);

    // THEN the table header reflects it instead of the default
    const actualTable = within(screen.getByRole("table", { name: LABEL }));
    expect(actualTable.getByRole("columnheader", { name: "Quarter" })).toBeInTheDocument();
  });

  it("should show the empty state rather than a bare set of axes when there is no series", () => {
    // GIVEN no data at all
    // WHEN the chart is rendered
    render(<LineChart label={LABEL} series={[]} />);

    // THEN the reader is told so instead of being shown an empty grid
    expect(screen.getByTestId(DATA_TEST_ID.EMPTY)).toBeInTheDocument();
  });

  it("should show the empty state when every series carries no points", () => {
    // GIVEN a named series with nothing in it
    const emptySeries: LineChartSeries = { id: "active", label: "Active users", points: [] };

    // WHEN it is rendered
    render(<LineChart label={LABEL} series={[emptySeries]} />);

    // THEN the chart reads as empty rather than drawing a flat line at zero
    expect(screen.getByTestId(DATA_TEST_ID.EMPTY)).toBeInTheDocument();
  });

  it("should show a loading message in the empty state while there is nothing to plot yet", () => {
    // GIVEN a chart with no data yet, still loading
    // WHEN it is rendered
    render(<LineChart label={LABEL} series={[]} isLoading />);

    // THEN the empty state reads as loading rather than as "no data"
    expect(screen.getByTestId(DATA_TEST_ID.EMPTY)).toHaveTextContent("Loading");
  });

  it("should hold the previous render at reduced opacity while loading, rather than replacing it", () => {
    // GIVEN a chart with data, mid-refetch
    // WHEN it is rendered as loading
    render(<LineChart label={LABEL} series={[ACTIVE_USERS]} isLoading />);

    // THEN it is marked busy and dimmed, but the chart itself is still shown
    const wrapper = screen.getByRole("table", { name: LABEL }).closest("[data-slot='line-chart']");
    expect(wrapper).toHaveAttribute("aria-busy", "true");
  });

  it("should draw a reference dot at the latest point of every series only when asked", () => {
    // GIVEN a chart rendered without end markers
    const { container, unmount } = render(<LineChart label={LABEL} series={[ACTIVE_USERS, CONVERSATIONS]} />);

    // THEN none are drawn
    expect(container.querySelectorAll(".recharts-reference-dot")).toHaveLength(0);
    unmount();

    // WHEN end markers are requested
    const { container: withMarkers } = render(
      <LineChart label={LABEL} series={[ACTIVE_USERS, CONVERSATIONS]} showEndMarker />
    );

    // THEN one is drawn per series
    expect(withMarkers.querySelectorAll(".recharts-reference-dot")).toHaveLength(2);
  });

  it("should hide the axes, grid, tooltip, legend and table when every chrome flag is set", () => {
    // GIVEN a chart rendered as a bare sparkline-style primitive
    const { container } = render(
      <LineChart
        label={LABEL}
        series={[ACTIVE_USERS, CONVERSATIONS]}
        hideAxes
        hideGrid
        hideTooltip
        hideLegend
        hideTable
      />
    );

    // THEN none of the chrome is present, but the series are still drawn
    expect(container.querySelector(".recharts-cartesian-grid")).not.toBeInTheDocument();
    expect(legend(container)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(renderedAreas(container)).toHaveLength(2);
    for (const tick of container.querySelectorAll(".recharts-cartesian-axis-tick")) {
      expect(tick).not.toBeVisible();
    }
  });
});
