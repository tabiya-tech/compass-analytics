import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ChartDataTable, DATA_TEST_ID, type ChartTable } from "./ChartDataTable";

// Placeholder data throughout — the real copy is not settled.
const TABLE: ChartTable = {
  caption: "New users by month",
  columns: ["Period", "New", "Returning"],
  rows: [
    { header: "Jul", cells: ["155", "63"] },
    { header: "Aug", cells: ["96", "41"] },
  ],
};

/** The exact same table, minus `sr-only` — so this story has something to look at, not just take on faith. */
function VisiblePreview({ table }: Readonly<{ table: ChartTable }>) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="mb-2 text-left font-medium text-foreground">{table.caption}</caption>
      <thead>
        <tr className="border-b">
          {table.columns.map((column) => (
            <th key={column} className="p-2 text-left text-muted-foreground">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row) => (
          <tr key={row.header} className="border-b">
            <th className="p-2 text-left font-normal">{row.header}</th>
            {row.cells.map((cell, index) => (
              <td key={table.columns[index + 1] ?? index} className="p-2">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const meta = {
  component: ChartDataTable,
  tags: ["autodocs"],
  args: { table: TABLE },
  decorators: [
    (Story, { args }) => (
      <div className="grid gap-4">
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">
            Used inside <code>BarChart</code>, <code>DonutChart</code>, <code>LineChart</code>, and{" "}
            <code>Histogram</code> — every chart renders one of these alongside its plot. It's `sr-only`, so it's
            invisible below on purpose; this is what it actually contains, shown visibly so it isn&apos;t just a blank
            box:
          </p>
          <div className="rounded-card border p-3">
            <VisiblePreview table={args.table} />
          </div>
        </div>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChartDataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UsedInsideEveryChart: Story = {
  name: "Used inside BarChart, DonutChart, LineChart, and Histogram",
  play: async ({ canvas }) => {
    const table = within(canvas.getByTestId(DATA_TEST_ID.TABLE));
    await expect(table.getByRole("rowheader", { name: "Jul" })).toBeInTheDocument();
    await expect(table.getByRole("cell", { name: "63" })).toBeInTheDocument();
  },
};
