import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { ChartDataTable, DATA_TEST_ID, type ChartTable } from "./ChartDataTable";

const TABLE: ChartTable = {
  caption: "New users by month",
  columns: ["Period", "New", "Returning"],
  rows: [
    { header: "Jul", cells: ["155", "63"] },
    { header: "Aug", cells: ["96", "41"] },
  ],
};

describe("ChartDataTable", () => {
  it("should keep every plotted value reachable, captioned and headed", () => {
    // GIVEN a chart whose values are otherwise only in its marks
    // WHEN its table is rendered
    render(<ChartDataTable table={TABLE} />);

    // THEN the same numbers are available as a table, captioned and headed
    const actualTable = within(screen.getByTestId(DATA_TEST_ID.TABLE));
    expect(screen.getByRole("table", { name: TABLE.caption })).toBeInTheDocument();
    expect(actualTable.getByRole("columnheader", { name: "Returning" })).toBeInTheDocument();
    expect(actualTable.getByRole("rowheader", { name: "Jul" })).toBeInTheDocument();
    expect(actualTable.getByRole("cell", { name: "63" })).toBeInTheDocument();
  });

  it("should stay visually hidden, since it exists for assistive tech, not sighted readers", () => {
    // GIVEN a chart's data table
    // WHEN it is rendered
    render(<ChartDataTable table={TABLE} />);

    // THEN it carries the sr-only treatment rather than sitting in the layout
    expect(screen.getByTestId(DATA_TEST_ID.TABLE)).toHaveClass("sr-only");
  });
});
