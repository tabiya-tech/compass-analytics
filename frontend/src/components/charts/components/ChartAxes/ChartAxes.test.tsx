import { describe, expect, it } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import { ChartGrid, ChartXLabels, labelStride, DATA_TEST_ID } from "./ChartAxes";
import { plotFrom } from "@/components/charts/chart-scale";

const PLOT = plotFrom(400, 200, { top: 20, right: 12, bottom: 28, left: 44 });

describe("labelStride", () => {
  it("should show every label when the plot is wide enough for all of them", () => {
    // GIVEN four labels and a plot with room for well over four
    const givenLabels = ["Jan", "Feb", "Mar", "Apr"];

    // WHEN the stride is computed for a wide plot
    const actualStride = labelStride(givenLabels, 400);

    // THEN nothing is thinned out
    expect(actualStride).toBe(1);
  });

  it("should thin the labels out once there is no longer room for all of them", () => {
    // GIVEN twelve labels and a plot too narrow to fit all of them at ~56px each
    const givenLabels = Array.from({ length: 12 }, (_, index) => `Month ${index}`);

    // WHEN the stride is computed for that plot
    const actualStride = labelStride(givenLabels, 300);

    // THEN only every second (or coarser) label is kept
    expect(actualStride).toBeGreaterThan(1);
  });

  it("should never divide by a zero-width plot", () => {
    // GIVEN a plot with no width left to draw in
    const givenLabels = ["Jan", "Feb"];

    // WHEN the stride is computed
    const actualStride = labelStride(givenLabels, 0);

    // THEN it falls back to showing as few labels as it must, not NaN or Infinity
    expect(Number.isFinite(actualStride)).toBe(true);
    expect(actualStride).toBeGreaterThanOrEqual(1);
  });
});

describe("ChartGrid", () => {
  it("should draw one gridline and one value label per tick", () => {
    // GIVEN four round ticks
    const givenTicks = [0, 100, 200, 300];

    // WHEN it is rendered
    render(
      <svg>
        <ChartGrid ticks={givenTicks} max={300} plot={PLOT} />
      </svg>
    );

    // THEN each tick gets a labelled gridline
    expect(screen.getAllByTestId(DATA_TEST_ID.Y_TICK)).toHaveLength(givenTicks.length);
    expect(screen.getByText("300")).toBeInTheDocument();
  });

  it("should format tick labels the way the caller asks", () => {
    // GIVEN a formatter for the ticks' unit
    const minutes = (value: number) => `${value}m`;

    // WHEN it is rendered with it
    render(
      <svg>
        <ChartGrid ticks={[0, 15]} max={15} plot={PLOT} formatTick={minutes} />
      </svg>
    );

    // THEN the formatted label is shown
    expect(screen.getByText("15m")).toBeInTheDocument();
  });

  it("should be hidden from assistive tech, since the same values are in the data table", () => {
    // GIVEN a grid
    // WHEN it is rendered
    render(
      <svg>
        <ChartGrid ticks={[0, 10]} max={10} plot={PLOT} />
      </svg>
    );

    // THEN it carries aria-hidden rather than being announced
    expect(screen.getByTestId(DATA_TEST_ID.GRID_CONTAINER)).toHaveAttribute("aria-hidden", "true");
  });
});

describe("ChartXLabels", () => {
  const xOf = (index: number) => PLOT.left + index * 20;

  it("should show every label when there is room for all of them", () => {
    // GIVEN four category labels and a plot wide enough for all of them
    const givenLabels = ["Jan", "Feb", "Mar", "Apr"];

    // WHEN it is rendered
    render(
      <svg>
        <ChartXLabels labels={givenLabels} plot={PLOT} xOf={xOf} />
      </svg>
    );

    // THEN all four are shown
    expect(screen.getAllByTestId(DATA_TEST_ID.X_LABEL)).toHaveLength(givenLabels.length);
  });

  it("should always keep the last label, even when thinning drops it from the stride", () => {
    // GIVEN enough labels that thinning would otherwise skip the final one
    const givenLabels = Array.from({ length: 11 }, (_, index) => `Month ${index}`);
    const narrowPlot = plotFrom(150, 200, { top: 20, right: 12, bottom: 28, left: 44 });

    // WHEN it is rendered against a narrow plot
    render(
      <svg>
        <ChartXLabels labels={givenLabels} plot={narrowPlot} xOf={xOf} />
      </svg>
    );

    // THEN the axis still ends on the final label, rather than stopping short
    expect(screen.getByText("Month 10")).toBeInTheDocument();
  });
});
