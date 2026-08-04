import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { ChartLegend, DATA_TEST_ID } from "./ChartLegend";

const SERIES = [
  { id: "a", label: "Series A", color: "var(--chart-1)" },
  { id: "b", label: "Series B", color: "var(--chart-2)" },
];

const SLICES = [
  { id: "a", label: "Group A", color: "var(--chart-1)", value: "52%" },
  { id: "b", label: "Group B", color: "var(--chart-2)", value: "41%" },
];

describe("ChartLegend", () => {
  it("should list one entry per item, each named by its label", () => {
    // GIVEN two series
    // WHEN it is rendered
    render(<ChartLegend items={SERIES} />);

    // THEN there is one entry per series
    expect(screen.getAllByTestId(DATA_TEST_ID.ITEM)).toHaveLength(SERIES.length);
    expect(screen.getByText("Series A")).toBeInTheDocument();
  });

  it("should offer nothing as a control when there is no selection handler", () => {
    // GIVEN a legend with no onSelect
    // WHEN it is rendered
    render(<ChartLegend items={SERIES} />);

    // THEN it reads as plain text, not an interactive control
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("should show each entry's value alongside its label, when given one", () => {
    // GIVEN items carrying a value
    // WHEN it is rendered
    render(<ChartLegend items={SLICES} orientation="vertical" />);

    // THEN both the label and the value are visible
    expect(screen.getByText("Group A")).toBeInTheDocument();
    expect(screen.getByText("52%")).toBeInTheDocument();
  });

  it("should become a set of pressable controls once a selection handler is given", () => {
    // GIVEN a legend that can filter, with one entry already selected
    const givenOnSelect = vi.fn();

    // WHEN it is rendered
    render(<ChartLegend items={SLICES} onSelect={givenOnSelect} selectedId="a" />);

    // THEN the selected entry is pressed, and the rest are not
    expect(screen.getByRole("button", { name: /Group A/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Group B/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("should ask to select an entry on click, and to clear it when the same entry is already selected", async () => {
    // GIVEN an interactive legend
    const givenUser = userEvent.setup();
    const givenOnSelect = vi.fn();
    const { rerender } = render(<ChartLegend items={SLICES} onSelect={givenOnSelect} selectedId={null} />);

    // WHEN an unselected entry is clicked
    await givenUser.click(screen.getByRole("button", { name: /Group B/ }));

    // THEN the handler is asked to select it
    expect(givenOnSelect).toHaveBeenCalledWith("b");

    // WHEN that same entry, now selected, is clicked again
    rerender(<ChartLegend items={SLICES} onSelect={givenOnSelect} selectedId="b" />);
    await givenUser.click(screen.getByRole("button", { name: /Group B/ }));

    // THEN the handler is asked to clear the selection instead
    expect(givenOnSelect).toHaveBeenCalledWith(null);
  });

  it("should render no entries when there is nothing to show", () => {
    // GIVEN an empty legend
    // WHEN it is rendered
    render(<ChartLegend items={[]} />);

    // THEN there is nothing to list
    const actualLegend = within(screen.getByTestId(DATA_TEST_ID.CONTAINER));
    expect(actualLegend.queryAllByTestId(DATA_TEST_ID.ITEM)).toHaveLength(0);
  });
});
