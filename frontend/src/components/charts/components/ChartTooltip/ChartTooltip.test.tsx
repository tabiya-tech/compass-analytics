import { describe, expect, it } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import { ChartTooltip, DATA_TEST_ID } from "./ChartTooltip";

const CONTAINER_WIDTH = 440;

const ROWS = [
  { label: "Series A", value: "258", color: "var(--chart-1)" },
  { label: "Series B", value: "105", color: "var(--chart-2)" },
];

describe("ChartTooltip", () => {
  it("should name the hovered point and list a row per series", () => {
    // GIVEN a point with two series
    // WHEN it is rendered
    render(<ChartTooltip title="Mar" rows={ROWS} x={120} y={80} containerWidth={CONTAINER_WIDTH} />);

    // THEN the title and every row's value and label are shown
    expect(screen.getByText("Mar")).toBeInTheDocument();
    expect(screen.getAllByTestId(DATA_TEST_ID.ROW)).toHaveLength(ROWS.length);
    expect(screen.getByText("258")).toBeInTheDocument();
    expect(screen.getByText("Series A")).toBeInTheDocument();
  });

  it("should stay unflipped well clear of the right edge", () => {
    // GIVEN a point far from the right edge
    // WHEN it is rendered
    render(<ChartTooltip title="Mar" rows={ROWS} x={20} y={80} containerWidth={CONTAINER_WIDTH} />);

    // THEN it opens to the right of the point
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).not.toHaveClass("-translate-x-full");
  });

  it("should flip to the left near the right edge, so the card stays inside the chart", () => {
    // GIVEN a point close enough to the right edge that the card would overflow
    // WHEN it is rendered
    render(<ChartTooltip title="Mar" rows={ROWS} x={CONTAINER_WIDTH - 20} y={80} containerWidth={CONTAINER_WIDTH} />);

    // THEN it opens to the left of the point instead
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveClass("-translate-x-full");
  });

  it("should hide itself from assistive tech, since the same values are in the data table", () => {
    // GIVEN a tooltip over the chart
    // WHEN it is rendered
    render(<ChartTooltip title="Mar" rows={ROWS} x={120} y={80} containerWidth={CONTAINER_WIDTH} />);

    // THEN it carries aria-hidden rather than being announced on top of the table
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveAttribute("aria-hidden", "true");
  });
});
