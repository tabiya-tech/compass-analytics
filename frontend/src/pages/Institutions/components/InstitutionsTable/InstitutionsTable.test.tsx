import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { MODULE_IDS } from "@/access/AccessContext";
import type { InstitutionSummary, InstitutionsSort } from "@/institutions/institutions.types";
import { getInstitutionColumns } from "./columns";
import { DATA_TEST_ID, InstitutionsTable, type InstitutionsTableProps } from "./InstitutionsTable";

const GIVEN_INSTITUTIONS: InstitutionSummary[] = [
  {
    id: "inst-1",
    name: "Mazabuka Livelihoods Trust",
    region: "Southern",
    registered_users: 4685,
    active_users: 1643,
    module_started_pct: { [MODULE_IDS.BUILD_YOUR_PROFILE]: 46, [MODULE_IDS.JOB_READINESS]: 35 },
    skills_reports: 1204,
  },
  {
    id: "inst-2",
    name: "Kitwe Employment Network",
    region: "Copperbelt",
    registered_users: 1288,
    active_users: 525,
    // No Job readiness figure, so that column has nothing to show for this institution.
    module_started_pct: { [MODULE_IDS.BUILD_YOUR_PROFILE]: 49 },
  },
];

const GIVEN_REGION_OPTIONS = [
  { value: "Southern", label: "Southern" },
  { value: "Copperbelt", label: "Copperbelt" },
];

function renderTable(props: Partial<InstitutionsTableProps> = {}) {
  const onSortChange = vi.fn();
  const onSelectedRegionsChange = vi.fn();
  const onClearFilters = vi.fn();
  const onInstitutionSelect = vi.fn();
  const givenSort: InstitutionsSort = { by: "registered_users", direction: "desc" };

  render(
    <InstitutionsTable
      institutions={GIVEN_INSTITUTIONS}
      columns={getInstitutionColumns([MODULE_IDS.BUILD_YOUR_PROFILE, MODULE_IDS.JOB_READINESS])}
      sort={givenSort}
      onSortChange={onSortChange}
      regionOptions={GIVEN_REGION_OPTIONS}
      selectedRegions={[]}
      onSelectedRegionsChange={onSelectedRegionsChange}
      onClearFilters={onClearFilters}
      onInstitutionSelect={onInstitutionSelect}
      {...props}
    />
  );

  return { onSortChange, onSelectedRegionsChange, onClearFilters, onInstitutionSelect };
}

describe("InstitutionsTable", () => {
  it("should show one row per institution, with its figures formatted for reading", () => {
    // GIVEN two institutions
    // WHEN the table is rendered
    renderTable();

    // THEN each gets a row
    const rows = screen.getAllByTestId(DATA_TEST_ID.ROW);
    expect(rows).toHaveLength(2);

    // AND the first row reads its name, region, thousands-separated counts and module percentages
    const firstRow = within(rows[0]);
    expect(firstRow.getByText("Mazabuka Livelihoods Trust")).toBeInTheDocument();
    expect(firstRow.getByText("Southern")).toBeInTheDocument();
    expect(firstRow.getByText("4,685")).toBeInTheDocument();
    expect(firstRow.getByText("1,643")).toBeInTheDocument();
    expect(firstRow.getByText("46%")).toBeInTheDocument();
    expect(firstRow.getByText("1,204")).toBeInTheDocument();
  });

  it("should show a dash where an institution has no figure for a column", () => {
    // GIVEN an institution with no Job readiness figure and no skills reports
    // WHEN the table is rendered
    renderTable();

    // THEN those cells read as having nothing to show
    const secondRow = within(screen.getAllByTestId(DATA_TEST_ID.ROW)[1]);
    expect(secondRow.getAllByText("—")).toHaveLength(2);
  });

  it("should render a column per given column, labelled with the design's copy", () => {
    // GIVEN a two-module deployment
    // WHEN the table is rendered
    renderTable();

    // THEN the headers read as designed
    expect(screen.getByRole("columnheader", { name: /Institution/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /BYP % started/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Job readiness % started/ })).toBeInTheDocument();
    // AND a module the deployment doesn't run has no column
    expect(screen.queryByRole("columnheader", { name: /Career Explorer/ })).not.toBeInTheDocument();
  });

  it("should mark the sorted column, and only that one, with its sort direction", () => {
    // GIVEN a table sorted by registered users, high to low
    // WHEN it is rendered
    renderTable();

    // THEN that column announces its direction
    expect(screen.getByRole("columnheader", { name: /Reg\. users/ })).toHaveAttribute("aria-sort", "descending");
    // AND no other column claims to be sorted
    expect(screen.getByRole("columnheader", { name: /Active users/ })).not.toHaveAttribute("aria-sort");
  });

  it("should sort a figures column high to low when it is first clicked", async () => {
    // GIVEN a table sorted by another column
    const { onSortChange } = renderTable();

    // WHEN the active users header is clicked
    await userEvent.click(screen.getByRole("button", { name: "Sort by Active users" }));

    // THEN the biggest numbers are asked for first
    expect(onSortChange).toHaveBeenCalledWith({ by: "active_users", direction: "desc" });
  });

  it("should sort the institution names A to Z when that column is first clicked", async () => {
    // GIVEN a table sorted by another column
    const { onSortChange } = renderTable();

    // WHEN the institution header is clicked
    await userEvent.click(screen.getByRole("button", { name: "Sort by Institution" }));

    // THEN names start at the top of the alphabet, unlike figures
    expect(onSortChange).toHaveBeenCalledWith({ by: "name", direction: "asc" });
  });

  it("should flip the direction when the already-sorted column is clicked again", async () => {
    // GIVEN a table sorted by registered users, high to low
    const { onSortChange } = renderTable();

    // WHEN that same header is clicked
    await userEvent.click(screen.getByRole("button", { name: "Sort by Reg. users" }));

    // THEN the sort reverses rather than restarting
    expect(onSortChange).toHaveBeenCalledWith({ by: "registered_users", direction: "asc" });
  });

  it("should filter — not sort — by region, offering every region as an option", async () => {
    // GIVEN a table with a region column
    const { onSelectedRegionsChange } = renderTable();

    // THEN region offers no sort control
    expect(screen.queryByRole("button", { name: "Sort by Region" })).not.toBeInTheDocument();

    // WHEN the region filter is opened and a region is ticked
    await userEvent.click(screen.getByRole("button", { name: "Filter by Region" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Copperbelt" }));

    // THEN the selection is reported back
    expect(onSelectedRegionsChange).toHaveBeenCalledWith(["Copperbelt"]);
  });

  it("should open the drill-down for the institution whose row is clicked", async () => {
    // GIVEN a table of institutions
    const { onInstitutionSelect } = renderTable();

    // WHEN a row is clicked anywhere
    await userEvent.click(within(screen.getAllByTestId(DATA_TEST_ID.ROW)[1]).getByText("525"));

    // THEN that institution is the one asked for
    expect(onInstitutionSelect).toHaveBeenCalledTimes(1);
    expect(onInstitutionSelect).toHaveBeenCalledWith(GIVEN_INSTITUTIONS[1]);
  });

  it("should let a keyboard user open the drill-down from the institution name", async () => {
    // GIVEN a table of institutions
    const { onInstitutionSelect } = renderTable();

    // WHEN the name is activated as a button
    await userEvent.click(screen.getByRole("button", { name: "Mazabuka Livelihoods Trust" }));

    // THEN the drill-down opens once — the row's own click doesn't double it up
    expect(onInstitutionSelect).toHaveBeenCalledTimes(1);
    expect(onInstitutionSelect).toHaveBeenCalledWith(GIVEN_INSTITUTIONS[0]);
  });

  it("should explain that nothing matched, and offer a way back, when there are no institutions to show", async () => {
    // GIVEN a search and filter combination that matched nothing
    const { onClearFilters } = renderTable({ institutions: [] });

    // THEN the empty state explains why the table is empty
    expect(screen.getByRole("status")).toHaveTextContent("No institutions match your search or filters.");
    expect(screen.queryAllByTestId(DATA_TEST_ID.ROW)).toHaveLength(0);
    // AND the column headers stay, so the filter is still reachable
    expect(screen.getByRole("button", { name: "Filter by Region" })).toBeInTheDocument();

    // WHEN the way back is taken
    await userEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));

    // THEN the search and filters are cleared
    expect(onClearFilters).toHaveBeenCalled();
  });
});
