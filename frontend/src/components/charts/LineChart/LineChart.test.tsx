import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { LineChart, DATA_TEST_ID, type LineChartSeries } from "./LineChart";
import { DATA_TEST_ID as FRAME_TEST_ID } from "@/components/charts/components/ChartFrame";
import { DATA_TEST_ID as LEGEND_TEST_ID } from "@/components/charts/components/ChartLegend";

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

describe("LineChart", () => {
  it("should name the plot for assistive tech", () => {
    // GIVEN a single time series
    // WHEN it is rendered
    render(<LineChart label={LABEL} series={[ACTIVE_USERS]} />);

    // THEN the SVG is reachable as one named image
    expect(screen.getByRole("img", { name: LABEL })).toBeInTheDocument();
  });

  it("should draw one line per series", () => {
    // GIVEN two series over the same months
    // WHEN they are rendered
    render(<LineChart label={LABEL} series={[ACTIVE_USERS, CONVERSATIONS]} />);

    // THEN each gets its own line
    expect(screen.getAllByTestId(DATA_TEST_ID.LINE)).toHaveLength(2);
  });

  it("should wash the area under each line only when asked", () => {
    // GIVEN a series rendered without a fill
    const { unmount } = render(<LineChart label={LABEL} series={[ACTIVE_USERS]} />);

    // THEN only the line is drawn
    expect(screen.queryByTestId(DATA_TEST_ID.AREA)).not.toBeInTheDocument();
    unmount();

    // WHEN the same series is rendered filled
    render(<LineChart label={LABEL} series={[ACTIVE_USERS]} filled />);

    // THEN the area is washed in under it
    expect(screen.getAllByTestId(DATA_TEST_ID.AREA)).toHaveLength(1);
  });

  it("should show a legend only once there is more than one series to tell apart", () => {
    // GIVEN a lone series, which the chart's own title already names
    const { unmount } = render(<LineChart label={LABEL} series={[ACTIVE_USERS]} />);

    // THEN a legend would only restate the title, so there isn't one
    expect(screen.queryByTestId(LEGEND_TEST_ID.CONTAINER)).not.toBeInTheDocument();
    unmount();

    // WHEN a second series is added
    render(<LineChart label={LABEL} series={[ACTIVE_USERS, CONVERSATIONS]} />);

    // THEN identity stops depending on colour alone and the legend appears
    const actualLegend = within(screen.getByTestId(LEGEND_TEST_ID.CONTAINER));
    expect(actualLegend.getByText("Active users")).toBeInTheDocument();
    expect(actualLegend.getByText("Conversations")).toBeInTheDocument();
  });

  it("should keep every plotted value reachable in the data table", () => {
    // GIVEN two series whose values are only otherwise shown on hover
    // WHEN they are rendered
    render(<LineChart label={LABEL} series={[ACTIVE_USERS, CONVERSATIONS]} />);

    // THEN the numbers are all in the table, row by period
    const actualTable = within(screen.getByTestId(FRAME_TEST_ID.TABLE));
    expect(actualTable.getByRole("columnheader", { name: "Period" })).toBeInTheDocument();
    expect(actualTable.getByRole("rowheader", { name: "Sep" })).toBeInTheDocument();
    expect(actualTable.getByRole("cell", { name: "320" })).toBeInTheDocument();
    expect(actualTable.getByRole("cell", { name: "210" })).toBeInTheDocument();
  });

  it("should show the empty state rather than a bare set of axes when there is no series", () => {
    // GIVEN no data at all
    // WHEN the chart is rendered
    render(<LineChart label={LABEL} series={[]} />);

    // THEN the reader is told so instead of being shown an empty grid
    expect(screen.getByTestId(FRAME_TEST_ID.EMPTY)).toBeInTheDocument();
    expect(screen.queryByTestId(FRAME_TEST_ID.PLOT)).not.toBeInTheDocument();
  });

  it("should show the empty state when a series carries no points", () => {
    // GIVEN a named series with nothing in it
    const emptySeries: LineChartSeries = { id: "active", label: "Active users", points: [] };

    // WHEN it is rendered
    render(<LineChart label={LABEL} series={[emptySeries]} />);

    // THEN the chart reads as empty rather than drawing a flat line at zero
    expect(screen.getByTestId(FRAME_TEST_ID.EMPTY)).toBeInTheDocument();
  });

  it("should keep the crosshair and its markers off the plot until the pointer arrives", () => {
    // GIVEN a chart nobody is hovering
    // WHEN it is rendered
    render(<LineChart label={LABEL} series={[ACTIVE_USERS, CONVERSATIONS]} />);

    // THEN no crosshair or marker is drawn
    expect(screen.queryByTestId(DATA_TEST_ID.CROSSHAIR)).not.toBeInTheDocument();
    expect(screen.queryAllByTestId(DATA_TEST_ID.MARKER)).toHaveLength(0);
  });
});
