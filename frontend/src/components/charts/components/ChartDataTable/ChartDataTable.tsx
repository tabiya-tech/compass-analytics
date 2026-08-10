const uniqueId = "3a1e8f42-6d5b-4c19-9f77-2b0c8d4e1a63";

export const DATA_TEST_ID = {
  TABLE: `chart-data-table-${uniqueId}`,
};

export interface ChartTableRow {
  header: string;
  cells: readonly string[];
}

export interface ChartTable {
  caption: string;
  columns: readonly string[];
  rows: readonly ChartTableRow[];
}

export function ChartDataTable({ table }: Readonly<{ table: ChartTable }>) {
  return (
    <table data-slot="chart-data-table" data-testid={DATA_TEST_ID.TABLE} className="sr-only">
      <caption>{table.caption}</caption>
      <thead>
        <tr>
          {table.columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row) => (
          <tr key={row.header}>
            <th scope="row">{row.header}</th>
            {row.cells.map((cell, index) => (
              <td key={table.columns[index + 1] ?? index}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
