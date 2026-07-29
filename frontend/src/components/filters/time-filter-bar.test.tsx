import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@/_test_utilities/test-utils";
import { FiltersProvider } from "@/filters/FiltersContext";
import { createInitialFilters } from "@/filters/filters";
import { TimeFilterBar, type TimeFilterBarProps } from "./time-filter-bar";

const GIVEN_TODAY = new Date(2026, 5, 15);

function renderBar(props: Partial<TimeFilterBarProps> = {}) {
  render(
    <FiltersProvider initialFilters={createInitialFilters(GIVEN_TODAY)}>
      <TimeFilterBar {...props} />
    </FiltersProvider>
  );
}

describe("TimeFilterBar", () => {
  it("should render labelled start and end date inputs showing the current range", () => {
    // GIVEN the time filter bar
    // WHEN rendered
    renderBar();

    // THEN both inputs are reachable by their label and hold the range
    expect(screen.getByLabelText("Start date")).toHaveValue("2026-05-16");
    expect(screen.getByLabelText("End date")).toHaveValue("2026-06-15");
  });

  it("should show the granularity derived from the current span", () => {
    // GIVEN the default 30-day range
    // WHEN rendered
    renderBar();

    // THEN the badge reports "day"
    expect(screen.getByText("Grouped by day")).toBeInTheDocument();
  });

  it("should re-derive the granularity when the range crosses a boundary", () => {
    // GIVEN the default 30-day ("day") range
    renderBar();

    // WHEN extending the end date so the span is 77 days
    // (fireEvent, not userEvent.type — typing into <input type="date"> is locale/segment dependent)
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-08-01" } });

    // THEN the badge follows the new span
    expect(screen.getByText("Grouped by week")).toBeInTheDocument();
  });

  it("should hide the labels visually but keep them as the inputs' accessible names", () => {
    // GIVEN the bar rendered inside a card, where the dates speak for themselves
    renderBar({ showLabels: false });

    // THEN the inputs are still reachable by name, so the control stays usable by screen readers
    expect(screen.getByLabelText("Start date")).toBeInTheDocument();
    expect(screen.getByLabelText("End date")).toBeInTheDocument();

    // AND the label text is present but visually hidden rather than removed
    expect(screen.getByText("Start date")).toHaveClass("sr-only");
  });

  it("should hide the granularity badge when asked", () => {
    // GIVEN the bar with the derived-granularity readout turned off
    renderBar({ showGranularity: false });

    // THEN no granularity text renders, while the date inputs remain
    expect(screen.queryByText(/Grouped by/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Start date")).toBeInTheDocument();
  });

  it("should cross-constrain the two inputs so the range cannot be inverted", () => {
    // GIVEN the default range
    // WHEN rendered
    renderBar();

    // THEN each input is bounded by the other's current value
    expect(screen.getByLabelText("Start date")).toHaveAttribute("max", "2026-06-15");
    expect(screen.getByLabelText("End date")).toHaveAttribute("min", "2026-05-16");
  });
});
