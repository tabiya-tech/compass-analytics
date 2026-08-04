import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { ChartFrame, DATA_TEST_ID, type ChartTable } from "./ChartFrame";

const TABLE: ChartTable = {
  caption: "New users by month",
  columns: ["Period", "New", "Returning"],
  rows: [
    { header: "Jul", cells: ["155", "63"] },
    { header: "Aug", cells: ["96", "41"] },
  ],
};

const LABEL = "New and returning users by month";

function renderFrame(props: Partial<ComponentProps<typeof ChartFrame>> = {}) {
  return render(
    <ChartFrame label={LABEL} height={200} table={TABLE} {...props}>
      {(width) => <rect data-testid="mark" width={width} height={10} />}
    </ChartFrame>
  );
}

describe("ChartFrame", () => {
  it("should name the plot for assistive tech, so the SVG is not an unlabelled node", () => {
    // GIVEN a chart with something to draw
    // WHEN it is rendered
    renderFrame();

    // THEN the plot is a single named image rather than a pile of paths
    expect(screen.getByRole("img", { name: LABEL })).toBe(screen.getByTestId(DATA_TEST_ID.PLOT));
  });

  it("should draw its marks at the measured width of the container", () => {
    // GIVEN a chart in a measurable container
    // WHEN it is rendered
    renderFrame();

    // THEN the marks are laid out against a real pixel width
    expect(Number(screen.getByTestId("mark").getAttribute("width"))).toBeGreaterThan(0);
  });

  it("should keep every plotted value reachable in a visually hidden table", () => {
    // GIVEN a chart whose values are otherwise only in the marks and the tooltip
    // WHEN it is rendered
    renderFrame();

    // THEN the same numbers are available as a table, captioned and headed
    const actualTable = within(screen.getByTestId(DATA_TEST_ID.TABLE));
    expect(screen.getByRole("table", { name: TABLE.caption })).toBeInTheDocument();
    expect(actualTable.getByRole("columnheader", { name: "Returning" })).toBeInTheDocument();
    expect(actualTable.getByRole("rowheader", { name: "Jul" })).toBeInTheDocument();
    expect(actualTable.getByRole("cell", { name: "63" })).toBeInTheDocument();
  });

  it("should show the empty state instead of a plot when there is nothing to draw", () => {
    // GIVEN a chart with no data
    // WHEN it is rendered
    renderFrame({ isEmpty: true, emptyMessage: "No jobseekers in this range." });

    // THEN the reader is told so, and no empty axes are drawn
    expect(screen.getByText("No jobseekers in this range.")).toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.PLOT)).not.toBeInTheDocument();
  });

  it("should fall back to a general message when no empty copy is given", () => {
    // GIVEN a chart with no data and no message of its own
    // WHEN it is rendered
    renderFrame({ isEmpty: true });

    // THEN the shared copy stands in
    expect(screen.getByText("No data to show for this selection.")).toBeInTheDocument();
  });

  it("should say it is loading rather than empty on a first load", () => {
    // GIVEN a chart that has no data yet but is still fetching
    // WHEN it is rendered
    renderFrame({ isEmpty: true, isLoading: true, emptyMessage: "No jobseekers in this range." });

    // THEN it promises data rather than claiming there is none
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("No jobseekers in this range.")).not.toBeInTheDocument();
  });

  it("should hold the previous render while refetching, instead of flashing a skeleton", () => {
    // GIVEN a chart that already has data and is refetching
    // WHEN it is rendered
    renderFrame({ isLoading: true });

    // THEN the plot stays on screen, marked busy, so the card never jumps
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId(DATA_TEST_ID.PLOT)).toBeInTheDocument();
  });

  it("should not mark the frame busy when it is not loading", () => {
    // GIVEN a settled chart
    // WHEN it is rendered
    renderFrame();

    // THEN nothing announces a pending update
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).not.toHaveAttribute("aria-busy");
  });

  it("should render the footer and give the overlay the measured width", () => {
    // GIVEN a chart with a legend below it and a tooltip layer over it
    // WHEN it is rendered
    renderFrame({
      footer: <p>Legend goes here</p>,
      overlay: (width) => <p>{`overlay at ${width}`}</p>,
    });

    // THEN both are placed, and the overlay knows how wide the plot is so it
    // can flip a tooltip away from the edge
    expect(screen.getByText("Legend goes here")).toBeInTheDocument();
    expect(screen.getByText(/^overlay at [1-9]/)).toBeInTheDocument();
  });
});
