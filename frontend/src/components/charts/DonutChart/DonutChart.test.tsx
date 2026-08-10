import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { DonutChart, DATA_TEST_ID, type DonutSlice } from "./DonutChart";
import { DATA_TEST_ID as LEGEND_TEST_ID } from "@/components/charts/DonutChart/components/ChartLegend";

const LABEL = "Share by group";

// Placeholder fixtures — the real copy is not settled.
const GROUPS: readonly DonutSlice[] = [
  { id: "a", label: "Group A", value: 52 },
  { id: "b", label: "Group B", value: 41 },
  { id: "c", label: "Group C", value: 7 },
];

const SINGLE_SLICE: readonly DonutSlice[] = [{ id: "a", label: "Group A", value: 100 }];

/** Every slice is a `<path class="recharts-sector">`, whatever the ring's radius or gap. */
function renderedSlices(container: HTMLElement): SVGPathElement[] {
  return [...container.querySelectorAll<SVGPathElement>(".recharts-sector")];
}

describe("DonutChart", () => {
  it("should name the plot and draw a segment per slice", () => {
    // GIVEN a three-way split
    // WHEN it is rendered
    const { container } = render(<DonutChart label={LABEL} slices={GROUPS} />);

    // THEN the ring is one named image made of three segments
    expect(screen.getByRole("img", { name: LABEL })).toBeInTheDocument();
    expect(renderedSlices(container)).toHaveLength(GROUPS.length);
  });

  it("should give every slice its share in the legend, so no angle has to be judged", () => {
    // GIVEN a split that does not divide evenly
    // WHEN it is rendered
    render(<DonutChart label={LABEL} slices={GROUPS} />);

    // THEN each entry is named and carries its percentage
    const actualLegend = within(screen.getByTestId(LEGEND_TEST_ID.CONTAINER));
    expect(actualLegend.getByText("Group A")).toBeInTheDocument();
    expect(actualLegend.getByText("52%")).toBeInTheDocument();
    expect(actualLegend.getByText("7%")).toBeInTheDocument();
  });

  it("should keep every slice reachable in the data table", () => {
    // GIVEN a donut whose values are otherwise only in the legend
    // WHEN it is rendered
    render(<DonutChart label={LABEL} slices={GROUPS} />);

    // THEN the table lists each slice with its value and its share
    const actualTable = within(screen.getByRole("table", { name: LABEL }));
    expect(actualTable.getByRole("rowheader", { name: "Group B" })).toBeInTheDocument();
    expect(actualTable.getByRole("cell", { name: "41" })).toBeInTheDocument();
  });

  it("should show the centre figure without announcing it twice", () => {
    // GIVEN a donut with a figure in the hole
    // WHEN it is rendered
    render(<DonutChart label={LABEL} slices={GROUPS} centerLabel="2.2" centerCaption="avg logins / user" />);

    // THEN the figure is visible but hidden from assistive tech, since it
    // belongs to the stat beside the chart
    const actualCenter = screen.getByTestId(DATA_TEST_ID.CENTER_LABEL);
    expect(actualCenter).toHaveTextContent("2.2");
    expect(actualCenter).toHaveTextContent("avg logins / user");
    expect(actualCenter).toHaveAttribute("aria-hidden", "true");
  });

  it("should leave the hole empty when there is no centre figure", () => {
    // GIVEN a donut with nothing to put in the middle
    // WHEN it is rendered
    render(<DonutChart label={LABEL} slices={GROUPS} />);

    // THEN the middle stays empty
    expect(screen.queryByTestId(DATA_TEST_ID.CENTER_LABEL)).not.toBeInTheDocument();
  });

  it("should offer the filter through the legend, since the ring itself is opaque to assistive tech", async () => {
    // GIVEN a donut whose slices filter
    const onSelect = vi.fn();
    render(<DonutChart label={LABEL} slices={GROUPS} selectedId={null} onSelect={onSelect} />);

    // WHEN a legend entry is picked
    await userEvent.click(screen.getByRole("button", { name: /Group B/ }));

    // THEN the filter is raised for that slice
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("should clear the filter when the selected slice is picked again", async () => {
    // GIVEN a donut with a slice already selected
    const onSelect = vi.fn();
    render(<DonutChart label={LABEL} slices={GROUPS} selectedId="a" onSelect={onSelect} />);

    // AND the selection is exposed as a pressed toggle
    expect(screen.getByRole("button", { name: /Group A/ })).toHaveAttribute("aria-pressed", "true");

    // WHEN that same entry is picked
    await userEvent.click(screen.getByRole("button", { name: /Group A/ }));

    // THEN the filter clears
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("should draw a single slice as one uninterrupted segment, with no gap cut into it", () => {
    // GIVEN a whole made of one slice
    // WHEN it is rendered
    const { container } = render(<DonutChart label={LABEL} slices={SINGLE_SLICE} />);

    // THEN it is still drawn as a single ring, since a gap here would read as
    // a missing segment rather than as 100%
    expect(renderedSlices(container)).toHaveLength(1);
  });

  it("should show the empty state when there is nothing to divide", () => {
    // GIVEN no slices at all
    const { unmount } = render(<DonutChart label={LABEL} slices={[]} />);

    // THEN the reader is told so
    expect(screen.getByTestId(DATA_TEST_ID.EMPTY)).toBeInTheDocument();
    unmount();

    // AND the same when the slices exist but add up to nothing, which has no
    // shares to draw
    render(
      <DonutChart
        label={LABEL}
        slices={[
          { id: "a", label: "Group A", value: 0 },
          { id: "b", label: "Group B", value: 0 },
        ]}
      />
    );
    expect(screen.getByTestId(DATA_TEST_ID.EMPTY)).toBeInTheDocument();
  });
});
