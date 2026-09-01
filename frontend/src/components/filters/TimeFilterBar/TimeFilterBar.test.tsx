import { describe, expect, it } from "vitest";
import { render, screen, userEvent, waitFor } from "@/_test_utilities/test-utils";
import { FiltersProvider } from "@/filters/FiltersContext";
import { createInitialFilters } from "@/filters/filters";
import { TimeFilterBar, type TimeFilterBarProps } from "./TimeFilterBar";

const GIVEN_TODAY = new Date(2026, 5, 15);

function renderBar(props: Partial<TimeFilterBarProps> = {}) {
  render(
    <FiltersProvider initialFilters={createInitialFilters(GIVEN_TODAY)}>
      <TimeFilterBar {...props} />
    </FiltersProvider>
  );
}

function dayButton(date: Date) {
  // CalendarDayButton stamps each button with the same locale string the test computes here.
  return document.querySelector<HTMLButtonElement>(`[data-day="${date.toLocaleDateString()}"]`);
}

describe("TimeFilterBar", () => {
  it("should show a trigger labelled with the current range", () => {
    // GIVEN the time filter bar
    // WHEN rendered
    renderBar();

    // THEN the trigger is reachable by its label and shows the current range
    expect(screen.getByRole("button", { name: "Date range" })).toHaveTextContent("15 Jun 2025 – 15 Jun 2026");
  });

  it("should show the granularity derived from the current span", () => {
    // GIVEN the default 365-day range
    // WHEN rendered
    renderBar();

    // THEN the badge reports "month"
    expect(screen.getByText("Grouped by month")).toBeInTheDocument();
  });

  it("should re-derive the granularity when a picked range crosses a boundary", async () => {
    // GIVEN the default 365-day ("month") range — the left calendar panel opens anchored on the
    // range's start month (Jun 2025), independently navigable from the right (end-anchored) panel
    renderBar();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Date range" }));

    // WHEN picking a range that spans 51 days (Jun 20 – Aug 10 2025), navigating only the left panel
    const newStart = new Date(2025, 5, 20);
    const newEnd = new Date(2025, 7, 10);
    await user.click(dayButton(newStart)!);
    await user.click(screen.getAllByRole("button", { name: "Go to the Next Month" })[0]); // Jun -> Jul
    await user.click(screen.getAllByRole("button", { name: "Go to the Next Month" })[0]); // Jul -> Aug
    await user.click(dayButton(newEnd)!);

    // THEN the badge follows the new span
    expect(screen.getByText("Grouped by week")).toBeInTheDocument();
  });

  it("should hide the label visually but keep it as the trigger's accessible name", () => {
    // GIVEN the bar rendered inside a card, where the dates speak for themselves
    renderBar({ showLabels: false });

    // THEN the trigger is still reachable by name, so the control stays usable by screen readers
    expect(screen.getByRole("button", { name: "Date range" })).toBeInTheDocument();

    // AND the label text is present but visually hidden rather than removed
    expect(screen.getByText("Date range")).toHaveClass("sr-only");
  });

  it("should hide the granularity badge when asked", () => {
    // GIVEN the bar with the derived-granularity readout turned off
    renderBar({ showGranularity: false });

    // THEN no granularity text renders, while the range trigger remains
    expect(screen.queryByText(/Grouped by/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Date range" })).toBeInTheDocument();
  });

  it("should close the calendar and update the trigger once a full range is picked", async () => {
    // GIVEN the calendar open on the default range's start month
    renderBar();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Date range" }));

    // WHEN picking a new start and end day within the visible month
    const newStart = new Date(2025, 5, 4);
    const newEnd = new Date(2025, 5, 11);
    await user.click(dayButton(newStart)!);
    await user.click(dayButton(newEnd)!);

    // THEN the trigger reflects the new range and the calendar closes
    expect(screen.getByRole("button", { name: "Date range" })).toHaveTextContent("4 Jun 2025 – 11 Jun 2025");
    await waitFor(() => expect(screen.queryByRole("grid")).not.toBeInTheDocument());
  });
});
