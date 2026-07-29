import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render as renderWithoutProviders } from "@testing-library/react";
import { render, screen } from "@/_test_utilities/test-utils";
import { createInitialFilters } from "@/filters/filters";
import { FiltersProvider, useFilters } from "./FiltersContext";

const GIVEN_INITIAL_FILTERS = createInitialFilters(new Date(2026, 5, 15));

function FiltersProbe() {
  const { filters, patchFilters, setDateRange, clearFilter, clearAll, activeFilters } = useFilters();
  return (
    <div>
      <span data-testid="audience-segment">{filters.audienceSegment ?? ""}</span>
      <span data-testid="login-method">{filters.loginMethod ?? ""}</span>
      <span data-testid="date-range">{`${filters.dateRange.start}..${filters.dateRange.end}`}</span>
      <span data-testid="granularity">{filters.granularity}</span>
      <span data-testid="active-count">{activeFilters.length}</span>
      <button onClick={() => patchFilters({ audienceSegment: "youth", loginMethod: "email" })}>set two</button>
      <button onClick={() => setDateRange({ start: "2026-01-01", end: "2026-10-28" })}>set long range</button>
      <button onClick={() => clearFilter("audienceSegment")}>clear segment</button>
      <button onClick={clearAll}>clear all</button>
    </div>
  );
}

function renderProbe() {
  render(
    <FiltersProvider initialFilters={GIVEN_INITIAL_FILTERS}>
      <FiltersProbe />
    </FiltersProvider>
  );
}

describe("FiltersProvider", () => {
  it("should honor the provided initialFilters", () => {
    // GIVEN an explicit initial filters state
    // WHEN rendered
    renderProbe();

    // THEN the probe reflects that state, with no active chip filters
    expect(screen.getByTestId("date-range")).toHaveTextContent("2026-05-16..2026-06-15");
    expect(screen.getByTestId("granularity")).toHaveTextContent("day");
    expect(screen.getByTestId("active-count")).toHaveTextContent("0");
  });

  it("should set several filters at once via patchFilters", async () => {
    // GIVEN a mounted provider
    renderProbe();

    // WHEN patching two chip filters together
    await userEvent.click(screen.getByRole("button", { name: "set two" }));

    // THEN both are set and both count as active
    expect(screen.getByTestId("audience-segment")).toHaveTextContent("youth");
    expect(screen.getByTestId("login-method")).toHaveTextContent("email");
    expect(screen.getByTestId("active-count")).toHaveTextContent("2");
  });

  it("should re-derive granularity when the date range changes", async () => {
    // GIVEN the initial 30-day range at "day" granularity
    renderProbe();
    expect(screen.getByTestId("granularity")).toHaveTextContent("day");

    // WHEN setting a range spanning 300 days
    await userEvent.click(screen.getByRole("button", { name: "set long range" }));

    // THEN granularity follows the span
    expect(screen.getByTestId("date-range")).toHaveTextContent("2026-01-01..2026-10-28");
    expect(screen.getByTestId("granularity")).toHaveTextContent("month");
  });

  it("should clear exactly one filter via clearFilter", async () => {
    // GIVEN two chip filters set
    renderProbe();
    await userEvent.click(screen.getByRole("button", { name: "set two" }));

    // WHEN clearing only the audience segment
    await userEvent.click(screen.getByRole("button", { name: "clear segment" }));

    // THEN the other one survives
    expect(screen.getByTestId("audience-segment")).toHaveTextContent("");
    expect(screen.getByTestId("login-method")).toHaveTextContent("email");
  });

  it("should clear every chip filter via clearAll while preserving the date range and granularity", async () => {
    // GIVEN two chip filters set and a long (month-granularity) range
    renderProbe();
    await userEvent.click(screen.getByRole("button", { name: "set two" }));
    await userEvent.click(screen.getByRole("button", { name: "set long range" }));

    // WHEN clearing all
    await userEvent.click(screen.getByRole("button", { name: "clear all" }));

    // THEN the chips are gone but the time filters are untouched
    expect(screen.getByTestId("active-count")).toHaveTextContent("0");
    expect(screen.getByTestId("date-range")).toHaveTextContent("2026-01-01..2026-10-28");
    expect(screen.getByTestId("granularity")).toHaveTextContent("month");
  });
});

describe("useFilters", () => {
  it("should throw when used outside a FiltersProvider", () => {
    // GIVEN a component using useFilters with no provider above it
    // WHEN / THEN rendering it throws
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderWithoutProviders(<FiltersProbe />)).toThrow("useFilters must be used within a FiltersProvider.");
    consoleError.mockRestore();
  });
});
