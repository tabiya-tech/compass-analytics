import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/_test_utilities/test-utils";
import { HBar, DATA_TEST_ID, type HBarItem } from "./HBar";

const LABEL = "Values by category";

// Placeholder fixtures — the real copy is not settled.
const CATEGORIES: readonly HBarItem[] = [
  { id: "a", label: "Category A", value: 200 },
  { id: "b", label: "Category B", value: 150 },
  { id: "c", label: "Category C", value: 100 },
];

function rowPercentages(): number[] {
  return screen.getAllByTestId(DATA_TEST_ID.BAR).map((bar) => Number(bar.getAttribute("aria-valuenow")));
}

describe("HBar", () => {
  it("should draw one row per item, ranked in the order given", () => {
    // GIVEN a ranked list of categories
    // WHEN it is rendered
    render(<HBar label={LABEL} items={CATEGORIES} />);

    // THEN there is a row per item, each naming its value
    expect(screen.getAllByTestId(DATA_TEST_ID.ROW)).toHaveLength(CATEGORIES.length);
    expect(screen.getByText("Category A")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("should size each bar against the largest value in the list", () => {
    // GIVEN a list whose top value is 200
    // WHEN it is rendered
    render(<HBar label={LABEL} items={CATEGORIES} />);

    // THEN the leader fills its bar completely, and the rest scale beneath it
    const percentages = rowPercentages();
    expect(percentages[0]).toBe(100);
    expect(percentages[1]).toBeLessThan(percentages[0]);
    expect(percentages[2]).toBeLessThan(percentages[1]);
  });

  it("should size bars against an explicit maximum when one is given", () => {
    // GIVEN a scale set by a cohort total rather than by the top row
    // WHEN the leader is rendered against a maximum twice its own value
    render(<HBar label={LABEL} items={CATEGORIES} max={400} />);

    // THEN the same row reads at half scale, not full
    expect(rowPercentages()[0]).toBe(50);
  });

  it("should offer the filter directly on each row, since the label and value are already visible text", async () => {
    // GIVEN a ranking whose rows filter
    const onSelect = vi.fn();
    render(<HBar label={LABEL} items={CATEGORIES} selectedId={null} onSelect={onSelect} />);

    // WHEN a row is picked
    await userEvent.click(screen.getByRole("button", { name: /Category B/ }));

    // THEN the filter is raised for that item
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("should clear the filter when the selected item is picked again", async () => {
    // GIVEN a ranking with an item already selected
    const onSelect = vi.fn();
    render(<HBar label={LABEL} items={CATEGORIES} selectedId="a" onSelect={onSelect} />);

    // AND the selection is exposed as a pressed toggle
    expect(screen.getByRole("button", { name: /Category A/ })).toHaveAttribute("aria-pressed", "true");

    // WHEN that same entry is picked
    await userEvent.click(screen.getByRole("button", { name: /Category A/ }));

    // THEN the filter clears
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("should dim the bars that are not selected, leaving the label and value at full contrast", () => {
    // GIVEN a ranking with one item selected
    // WHEN it is rendered
    render(<HBar label={LABEL} items={CATEGORIES} selectedId="a" onSelect={vi.fn()} />);

    // THEN only the decorative bar fades back — the visible text it sits next
    // to must stay readable, since dimming it would drop it below the
    // contrast a screen needs regardless of selection
    const bars = screen.getAllByTestId(DATA_TEST_ID.BAR);
    expect(bars[0]).not.toHaveClass("opacity-40");
    expect(bars[1]).toHaveClass("opacity-40");
    expect(bars[2]).toHaveClass("opacity-40");
    for (const row of screen.getAllByTestId(DATA_TEST_ID.ROW)) {
      expect(row).not.toHaveClass("opacity-40");
    }
  });

  it("should leave every bar undimmed without a selection to compare against", () => {
    // GIVEN a ranking with a filter available but nothing picked yet
    // WHEN it is rendered
    render(<HBar label={LABEL} items={CATEGORIES} selectedId={null} onSelect={vi.fn()} />);

    // THEN nothing fades, since there is no selection to compare against
    for (const bar of screen.getAllByTestId(DATA_TEST_ID.BAR)) {
      expect(bar).not.toHaveClass("opacity-40");
    }
  });

  it("should not offer a filter when there is nothing to select with", () => {
    // GIVEN a ranking with no onSelect handler
    // WHEN it is rendered
    render(<HBar label={LABEL} items={CATEGORIES} />);

    // THEN the rows are plain text, not buttons
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("should show a greyed-out track with a short label when there is nothing to rank", () => {
    // GIVEN no items
    // WHEN the list is rendered
    render(<HBar label={LABEL} items={[]} />);

    // THEN a flat track stands in for the missing bars, labelled so it doesn't read as loading
    expect(screen.getByTestId(DATA_TEST_ID.EMPTY)).toHaveTextContent("No data to show for this selection.");
  });
});
