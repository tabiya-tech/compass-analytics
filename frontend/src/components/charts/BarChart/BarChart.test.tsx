import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { BarChart, DATA_TEST_ID, type BarChartSeries } from "./BarChart";
import { DATA_TEST_ID as FRAME_TEST_ID } from "@/components/charts/components/ChartFrame";
import { DATA_TEST_ID as LEGEND_TEST_ID } from "@/components/charts/components/ChartLegend";

const LABEL = "New and returning users by month";
const CATEGORIES = ["Jul", "Aug", "Sep", "Oct"];

const NEW_USERS: BarChartSeries = { id: "new", label: "New", values: [155, 96, 160, 152] };
const RETURNING_USERS: BarChartSeries = { id: "returning", label: "Returning", values: [63, 41, 66, 58] };

/** Bars are paths, so width comes from the geometry rather than an attribute. */
function barWidths(): number[] {
  return screen.getAllByTestId(DATA_TEST_ID.BAR).map((bar) => {
    const xs = [...(bar.getAttribute("d") ?? "").matchAll(/[ML](-?[\d.]+),/g)].map((match) => Number(match[1]));
    return Math.max(...xs) - Math.min(...xs);
  });
}

describe("BarChart", () => {
  it("should draw one bar per category for a single series", () => {
    // GIVEN one series across four months
    // WHEN it is rendered
    render(<BarChart label={LABEL} categories={CATEGORIES} series={[NEW_USERS]} />);

    // THEN there is a bar per month, and no legend to restate the title
    expect(screen.getAllByTestId(DATA_TEST_ID.BAR)).toHaveLength(CATEGORIES.length);
    expect(screen.queryByTestId(LEGEND_TEST_ID.CONTAINER)).not.toBeInTheDocument();
  });

  it("should stack a segment per series into each column", () => {
    // GIVEN two series over the same months
    // WHEN they are stacked
    render(<BarChart label={LABEL} categories={CATEGORIES} series={[NEW_USERS, RETURNING_USERS]} stacked />);

    // THEN every column carries a segment for each series, named by the legend
    expect(screen.getAllByTestId(DATA_TEST_ID.BAR)).toHaveLength(CATEGORIES.length * 2);
    const actualLegend = within(screen.getByTestId(LEGEND_TEST_ID.CONTAINER));
    expect(actualLegend.getByText("New")).toBeInTheDocument();
    expect(actualLegend.getByText("Returning")).toBeInTheDocument();
  });

  it("should give a stacked chart's data table the column total, since that is what the stack shows", () => {
    // GIVEN two stacked series
    // WHEN they are rendered
    render(<BarChart label={LABEL} categories={CATEGORIES} series={[NEW_USERS, RETURNING_USERS]} stacked />);

    // THEN the table carries each part and the whole the column is read against
    const actualTable = within(screen.getByTestId(FRAME_TEST_ID.TABLE));
    expect(actualTable.getByRole("columnheader", { name: "Total" })).toBeInTheDocument();
    expect(actualTable.getByRole("cell", { name: "218" })).toBeInTheDocument();
  });

  it("should leave the total out of a grouped chart's table, which has no stack to sum", () => {
    // GIVEN two series rendered side by side
    // WHEN they are rendered
    render(<BarChart label={LABEL} categories={CATEGORIES} series={[NEW_USERS, RETURNING_USERS]} stacked={false} />);

    // THEN each series still gets a column, but nothing claims a combined figure
    const actualTable = within(screen.getByTestId(FRAME_TEST_ID.TABLE));
    expect(actualTable.getByRole("columnheader", { name: "New" })).toBeInTheDocument();
    expect(actualTable.queryByRole("columnheader", { name: "Total" })).not.toBeInTheDocument();
  });

  it("should place grouped bars side by side, narrower than a stacked one", () => {
    // GIVEN two series rendered stacked
    const { unmount } = render(
      <BarChart label={LABEL} categories={CATEGORIES} series={[NEW_USERS, RETURNING_USERS]} stacked />
    );
    const expectedStackedWidth = barWidths()[0];
    unmount();

    // WHEN the same two series are grouped instead
    render(<BarChart label={LABEL} categories={CATEGORIES} series={[NEW_USERS, RETURNING_USERS]} stacked={false} />);

    // THEN each bar takes its share of the slot, so they fit beside each other
    expect(screen.getAllByTestId(DATA_TEST_ID.BAR)).toHaveLength(CATEGORIES.length * 2);
    expect(barWidths()[0]).toBeLessThan(expectedStackedWidth);
  });

  it("should cap bar width, so a bar never fills its whole band", () => {
    // GIVEN a chart with only two categories in a wide container
    // WHEN it is rendered
    render(<BarChart label={LABEL} categories={["Jul", "Aug"]} series={[{ ...NEW_USERS, values: [155, 96] }]} />);

    // THEN the bars stay thin and the band's leftover reads as deliberate air
    for (const width of barWidths()) {
      expect(width).toBeLessThanOrEqual(24);
    }
  });

  it("should give every column a full-height hit target, not just its painted bar", () => {
    // GIVEN a chart with a short bar in it
    // WHEN it is rendered
    render(<BarChart label={LABEL} categories={CATEGORIES} series={[NEW_USERS]} />);

    // THEN each category has a band covering the whole column height
    expect(screen.getAllByTestId(DATA_TEST_ID.BAND)).toHaveLength(CATEGORIES.length);
  });

  it("should draw no bar for a category with no value", () => {
    // GIVEN a series with a zero in it
    const withGap: BarChartSeries = { id: "new", label: "New", values: [155, 0, 160, 152] };

    // WHEN it is rendered
    render(<BarChart label={LABEL} categories={CATEGORIES} series={[withGap]} />);

    // THEN the empty month gets nothing rather than a hairline pretending to be a value
    expect(screen.getAllByTestId(DATA_TEST_ID.BAR)).toHaveLength(3);
  });

  it("should show the empty state when there is nothing to plot", () => {
    // GIVEN no categories and no series
    // WHEN the chart is rendered
    const { unmount } = render(<BarChart label={LABEL} categories={[]} series={[]} />);

    // THEN the reader is told so
    expect(screen.getByTestId(FRAME_TEST_ID.EMPTY)).toBeInTheDocument();
    unmount();

    // AND the same when there are months but no series to plot against them
    render(<BarChart label={LABEL} categories={CATEGORIES} series={[]} />);
    expect(screen.getByTestId(FRAME_TEST_ID.EMPTY)).toBeInTheDocument();
  });
});
