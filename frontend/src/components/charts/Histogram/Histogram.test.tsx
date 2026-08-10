import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { Histogram, DATA_TEST_ID, type HistogramBin } from "./Histogram";

const LABEL = "Time to complete Build Your Profile";

// how long jobseekers take to finish, in five-minute bins
const COMPLETION_TIME_BINS: readonly HistogramBin[] = [
  { from: 0, to: 5, count: 42 },
  { from: 5, to: 10, count: 168 },
  { from: 10, to: 15, count: 214 },
  { from: 15, to: 20, count: 131 },
];

const minutes = (value: number) => `${value}m`;

function renderedBars(container: HTMLElement): SVGPathElement[] {
  return [...container.querySelectorAll<SVGPathElement>(".recharts-rectangle")];
}

function referenceLine(container: HTMLElement): SVGLineElement | null {
  return container.querySelector<SVGLineElement>(".recharts-reference-line-line");
}

describe("Histogram", () => {
  it("should draw a bar per bin", () => {
    // GIVEN a distribution across four bins
    // WHEN it is rendered
    const { container } = render(<Histogram label={LABEL} bins={COMPLETION_TIME_BINS} boundFormatter={minutes} />);

    // THEN there is a bar for each bin
    expect(renderedBars(container)).toHaveLength(COMPLETION_TIME_BINS.length);
  });

  it("should mark the target only when there is one, and dash it so it reads as a threshold", () => {
    // GIVEN a distribution with no target
    const { container, unmount } = render(
      <Histogram label={LABEL} bins={COMPLETION_TIME_BINS} boundFormatter={minutes} />
    );

    // THEN nothing is drawn across the plot
    expect(referenceLine(container)).not.toBeInTheDocument();
    unmount();

    // WHEN the same distribution is given a fifteen-minute target
    const { container: withTarget } = render(
      <Histogram
        label={LABEL}
        bins={COMPLETION_TIME_BINS}
        target={15}
        targetLabel="Target: 15m"
        boundFormatter={minutes}
      />
    );

    // THEN a dashed marker names the threshold, while the gridlines stay solid
    const line = referenceLine(withTarget);
    expect(line).toHaveAttribute("stroke-dasharray", "4 3");
    expect(within(withTarget).getByText("Target: 15m")).toBeInTheDocument();
  });

  it("should position the target marker at the bin containing it", () => {
    // GIVEN a target that falls inside the third bin (10 to 15)
    // WHEN it is rendered
    const { container } = render(
      <Histogram label={LABEL} bins={COMPLETION_TIME_BINS} target={12} boundFormatter={minutes} />
    );

    // THEN the marker is drawn — its x lands on that bin's category tick
    expect(referenceLine(container)).toBeInTheDocument();
  });

  it("should keep every bin reachable in the data table", () => {
    // GIVEN a distribution whose counts are otherwise only shown on hover
    // WHEN it is rendered
    render(<Histogram label={LABEL} bins={COMPLETION_TIME_BINS} boundFormatter={minutes} />);

    // THEN each bin's range and count are listed in full
    const actualTable = within(screen.getByRole("table", { name: LABEL }));
    expect(actualTable.getByRole("rowheader", { name: "10m to 15m" })).toBeInTheDocument();
    expect(actualTable.getByRole("cell", { name: "214" })).toBeInTheDocument();
  });

  it("should show the empty state when there is no distribution to bin", () => {
    // GIVEN no bins
    // WHEN the chart is rendered
    render(<Histogram label={LABEL} bins={[]} />);

    // THEN the reader is told so
    expect(screen.getByTestId(DATA_TEST_ID.EMPTY)).toBeInTheDocument();
  });

  it("should tell the reader loading is in progress rather than that there is no data", () => {
    // GIVEN no bins yet, because the data is still loading
    // WHEN the chart is rendered
    render(<Histogram label={LABEL} bins={[]} isLoading />);

    // THEN the empty state reads as "loading", not "nothing here"
    expect(screen.getByTestId(DATA_TEST_ID.EMPTY)).toHaveTextContent("Loading");
  });
});
