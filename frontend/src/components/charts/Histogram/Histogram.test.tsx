import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { Histogram, DATA_TEST_ID, type HistogramBin } from "./Histogram";
import { DATA_TEST_ID as FRAME_TEST_ID } from "@/components/charts/components/ChartFrame";

const LABEL = "Time to complete Build Your Profile";

/** Build Your Profile: how long jobseekers take to finish, in five-minute bins. */
const COMPLETION_TIME_BINS: readonly HistogramBin[] = [
  { from: 0, to: 5, count: 42 },
  { from: 5, to: 10, count: 168 },
  { from: 10, to: 15, count: 214 },
  { from: 15, to: 20, count: 131 },
];

const UNEVEN_BINS: readonly HistogramBin[] = [
  { from: 0, to: 5, count: 42 },
  { from: 5, to: 10, count: 168 },
  { from: 10, to: 20, count: 345 },
  { from: 20, to: 40, count: 91 },
];

const minutes = (value: number) => `${value}m`;

function binWidths(): number[] {
  return screen.getAllByTestId(DATA_TEST_ID.BIN).map((bin) => Number(bin.getAttribute("data-bin-width")));
}

describe("Histogram", () => {
  it("should name the plot and draw a bar per bin", () => {
    // GIVEN a distribution across four bins
    // WHEN it is rendered
    render(<Histogram label={LABEL} bins={COMPLETION_TIME_BINS} boundFormatter={minutes} />);

    // THEN the plot is one named image with a bar for each bin
    expect(screen.getByRole("img", { name: LABEL })).toBeInTheDocument();
    expect(screen.getAllByTestId(DATA_TEST_ID.BIN)).toHaveLength(COMPLETION_TIME_BINS.length);
  });

  it("should draw bins on a continuous scale, so an uneven bin stays proportional", () => {
    // GIVEN bins of different widths
    // WHEN they are rendered
    render(<Histogram label={LABEL} bins={UNEVEN_BINS} boundFormatter={minutes} />);

    // THEN a bin twice as wide is drawn twice as wide, rather than flattened
    // into an equal slot
    const actualWidths = binWidths();
    expect(actualWidths[2]).toBeGreaterThan(actualWidths[1]);
    expect(actualWidths[3]).toBeGreaterThan(actualWidths[2]);
  });

  it("should give bins of equal span the same width", () => {
    // GIVEN four evenly spaced bins
    // WHEN they are rendered
    render(<Histogram label={LABEL} bins={COMPLETION_TIME_BINS} boundFormatter={minutes} />);

    // THEN every bar is the same width, whatever its count
    const actualWidths = binWidths();
    for (const width of actualWidths) {
      expect(width).toBeCloseTo(actualWidths[0], 5);
    }
  });

  it("should mark the target only when there is one, and dash it so it reads as a threshold", () => {
    // GIVEN a distribution with no target
    const { unmount } = render(<Histogram label={LABEL} bins={COMPLETION_TIME_BINS} boundFormatter={minutes} />);

    // THEN nothing is drawn across the plot
    expect(screen.queryByTestId(DATA_TEST_ID.TARGET)).not.toBeInTheDocument();
    unmount();

    // WHEN the same distribution is given a fifteen-minute target
    render(
      <Histogram
        label={LABEL}
        bins={COMPLETION_TIME_BINS}
        target={15}
        targetLabel="Target 15m"
        boundFormatter={minutes}
      />
    );

    // THEN a dashed marker names the threshold, while the gridlines stay solid
    expect(screen.getByTestId(DATA_TEST_ID.TARGET)).toHaveAttribute("stroke-dasharray", "4 3");
    expect(screen.getByTestId(DATA_TEST_ID.TARGET_LABEL)).toHaveTextContent("Target 15m");
  });

  it("should keep every bin reachable in the data table", () => {
    // GIVEN a distribution whose counts are otherwise only shown on hover
    // WHEN it is rendered
    render(<Histogram label={LABEL} bins={COMPLETION_TIME_BINS} boundFormatter={minutes} />);

    // THEN each bin's range and count are listed in full
    const actualTable = within(screen.getByTestId(FRAME_TEST_ID.TABLE));
    expect(actualTable.getByRole("rowheader", { name: "10m to 15m" })).toBeInTheDocument();
    expect(actualTable.getByRole("cell", { name: "214" })).toBeInTheDocument();
  });

  it("should show the empty state when there is no distribution to bin", () => {
    // GIVEN no bins
    // WHEN the chart is rendered
    render(<Histogram label={LABEL} bins={[]} />);

    // THEN the reader is told so instead of being shown an empty grid
    expect(screen.getByTestId(FRAME_TEST_ID.EMPTY)).toBeInTheDocument();
    expect(screen.queryByTestId(FRAME_TEST_ID.PLOT)).not.toBeInTheDocument();
  });
});
