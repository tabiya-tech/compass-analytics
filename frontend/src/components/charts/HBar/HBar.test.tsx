import { describe, expect, it } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import { HBar, DATA_TEST_ID, type HBarItem } from "./HBar";
import { seriesColorAt } from "@/components/charts/chart-palette";

const LABEL = "Values by category";

// Placeholder fixtures — the real copy is not settled.
const CATEGORIES: readonly HBarItem[] = [
  { id: "a", label: "Category A", value: 200 },
  { id: "b", label: "Category B", value: 150 },
  { id: "c", label: "Category C", value: 100 },
];

/** shadcn's Progress is a Radix progressbar, so the fill is reported as a value. */
function fillWidths(): number[] {
  return screen.getAllByTestId(DATA_TEST_ID.BAR).map((bar) => Number(bar.getAttribute("aria-valuenow")));
}

describe("HBar", () => {
  it("should render a row for every item, with its value outside the bar", () => {
    // GIVEN a ranked list of categories
    // WHEN it is rendered
    render(<HBar label={LABEL} items={CATEGORIES} />);

    // THEN each category gets a row, and its value sits where a short bar can't clip it
    expect(screen.getAllByTestId(DATA_TEST_ID.ROW)).toHaveLength(CATEGORIES.length);
    expect(screen.getByText("Category A")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("should size each bar against the largest value in the list", () => {
    // GIVEN a list whose top value is 200
    // WHEN it is rendered
    render(<HBar label={LABEL} items={CATEGORIES} />);

    // THEN the leader fills the track and the rest are drawn to the same scale
    expect(fillWidths()).toEqual([100, 75, 50]);
  });

  it("should size bars against an explicit maximum when one is given", () => {
    // GIVEN a scale set by the cohort total rather than by the top row
    const max = 400;

    // WHEN the list is rendered against it
    render(<HBar label={LABEL} items={CATEGORIES} max={max} />);

    // THEN the bars read as shares of everyone, so no row is forced to 100%
    expect(fillWidths()).toEqual([50, 37.5, 25]);
  });

  it("should be a read-only ranking, with nothing offering itself as a control", () => {
    // GIVEN a breakdown whose values are already written out beside every bar
    // WHEN it is rendered
    render(<HBar label={LABEL} items={CATEGORIES} />);

    // THEN there is nothing to click, since a click would reveal nothing new
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("should color the bars with the first slot by default", () => {
    // GIVEN a breakdown with no color of its own
    // WHEN it is rendered
    render(<HBar label={LABEL} items={CATEGORIES} />);

    // THEN the bars take the first categorical slot
    for (const bar of screen.getAllByTestId(DATA_TEST_ID.BAR)) {
      expect(bar.style.getPropertyValue("--h-bar-fill")).toBe(seriesColorAt(0));
    }
  });

  it("should take a color, so breakdowns sitting side by side stay distinguishable", () => {
    // GIVEN a second breakdown that needs its own hue
    const color = seriesColorAt(1);

    // WHEN it is rendered with that color
    render(<HBar label={LABEL} items={CATEGORIES} color={color} />);

    // THEN every bar in the group uses it
    for (const bar of screen.getAllByTestId(DATA_TEST_ID.BAR)) {
      expect(bar.style.getPropertyValue("--h-bar-fill")).toBe(color);
    }
  });

  it("should name the list for assistive tech when the label is not shown", () => {
    // GIVEN a breakdown whose title is supplied by the surrounding card
    // WHEN it is rendered without a heading
    render(<HBar label={LABEL} items={CATEGORIES} />);

    // THEN the list still carries the name, and nothing is drawn twice
    expect(screen.getByRole("list", { name: LABEL })).toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.HEADING)).not.toBeInTheDocument();
  });

  it("should render the label as a heading, and name the list by it, when asked to show it", () => {
    // GIVEN a breakdown that carries its own heading
    // WHEN it is rendered with the label shown
    render(<HBar label="Band" items={CATEGORIES} showLabel />);

    // THEN the heading is visible and names the list, rather than the name
    // being announced once as a heading and again as an aria-label
    expect(screen.getByTestId(DATA_TEST_ID.HEADING)).toHaveTextContent("Band");
    expect(screen.getByRole("list", { name: "Band" })).toBeInTheDocument();
    expect(screen.getByRole("list")).not.toHaveAttribute("aria-label");
  });

  it("should hide the decorative bar from assistive tech, since the value is already written out", () => {
    // GIVEN a ranked list
    // WHEN it is rendered
    render(<HBar label={LABEL} items={CATEGORIES} />);

    // THEN the bars add no second progressbar announcement per row
    for (const bar of screen.getAllByTestId(DATA_TEST_ID.BAR)) {
      expect(bar).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("should show the empty state when there is nothing to rank", () => {
    // GIVEN no items
    // WHEN the list is rendered
    render(<HBar label={LABEL} items={[]} />);

    // THEN the reader is told so rather than shown an empty frame
    expect(screen.getByTestId(DATA_TEST_ID.EMPTY)).toBeInTheDocument();
    expect(screen.getByText("No data to show for this selection.")).toBeInTheDocument();
  });
});
