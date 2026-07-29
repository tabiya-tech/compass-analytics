import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/_test_utilities/test-utils";
import type { AccessState } from "@/access/AccessContext";
import { AccessProvider } from "@/access/AccessContext";
import { FiltersProvider } from "@/filters/FiltersContext";
import { createInitialFilters, type FiltersState } from "@/filters/filters";
import { GlobalFilters } from "./global-filters";

const GIVEN_TODAY = new Date(2026, 5, 15);
const ALL_INSTITUTIONS: Partial<AccessState> = { scope: { type: "all" } };

function renderGlobalFilters(filters: Partial<FiltersState> = {}, access: Partial<AccessState> = {}) {
  const initialFilters: FiltersState = { ...createInitialFilters(GIVEN_TODAY), ...filters };
  render(
    <AccessProvider access={access}>
      <FiltersProvider initialFilters={initialFilters}>
        <GlobalFilters />
      </FiltersProvider>
    </AccessProvider>
  );
}

describe("GlobalFilters", () => {
  it("should render an empty state and no Clear all button when no chip filters are set", () => {
    // GIVEN no chip filters set
    // WHEN rendered
    renderGlobalFilters();

    // THEN the empty state shows and there's nothing to clear
    expect(screen.getByText("No filters applied")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear all" })).not.toBeInTheDocument();
  });

  it("should render a chip per active filter, with translated values", () => {
    // GIVEN all three chip filters set, for a cross-institution grant
    renderGlobalFilters(
      { audienceSegment: "youth", loginMethod: "email", institutionDrillDownId: "inst-1" },
      ALL_INSTITUTIONS
    );

    // THEN each renders as a chip — the institution id as-is, the others translated
    expect(screen.getByText("Institution: inst-1")).toBeInTheDocument();
    expect(screen.getByText("Audience segment: Youth")).toBeInTheDocument();
    expect(screen.getByText("Login method: Email")).toBeInTheDocument();
  });

  it("should show the institution chip for a grant covering several institutions but not all", () => {
    // GIVEN a grant explicitly covering a portfolio of three institutions (scope is not "all")
    renderGlobalFilters(
      { institutionDrillDownId: "inst-1" },
      { scope: { type: "institutions", institutionIds: ["inst-1", "inst-2", "inst-3"] } }
    );

    // THEN the drill-down chip still shows — it's meaningful whenever more than one is in scope
    expect(screen.getByText("Institution: inst-1")).toBeInTheDocument();
  });

  it("should suppress the institution chip for a single-institution grant", () => {
    // GIVEN an institution drill-down set, but the grant covers only one institution
    renderGlobalFilters(
      { institutionDrillDownId: "inst-1", audienceSegment: "women" },
      { scope: { type: "institutions", institutionIds: ["inst-1"] } }
    );

    // THEN the institution chip is hidden while the others still show
    expect(screen.queryByText(/Institution:/)).not.toBeInTheDocument();
    expect(screen.getByText("Audience segment: Women")).toBeInTheDocument();
  });

  it("should remove only the clicked filter, preserving the others", async () => {
    // GIVEN two chip filters set
    renderGlobalFilters({ audienceSegment: "youth", loginMethod: "email" });

    // WHEN removing the audience segment chip
    await userEvent.click(screen.getByRole("button", { name: "Remove Audience segment filter" }));

    // THEN only that one is gone
    expect(screen.queryByText(/Audience segment:/)).not.toBeInTheDocument();
    expect(screen.getByText("Login method: Email")).toBeInTheDocument();
  });

  it("should clear every chip filter when Clear all is clicked", async () => {
    // GIVEN two chip filters set
    renderGlobalFilters({ audienceSegment: "youth", loginMethod: "email" });

    // WHEN clicking Clear all
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));

    // THEN the empty state shows
    expect(screen.getByText("No filters applied")).toBeInTheDocument();
  });
});
