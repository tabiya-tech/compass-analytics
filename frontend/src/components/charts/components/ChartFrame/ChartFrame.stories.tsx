import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { ChartFrame, DATA_TEST_ID, type ChartTable } from "./ChartFrame";

// Placeholder data throughout — the real copy is not settled.
const TABLE: ChartTable = {
  caption: "New users by month",
  columns: ["Period", "New", "Returning"],
  rows: [
    { header: "Jul", cells: ["155", "63"] },
    { header: "Aug", cells: ["96", "41"] },
  ],
};

const LABEL = "New and returning users by month";

const meta = {
  component: ChartFrame,
  tags: ["autodocs"],
  args: {
    label: LABEL,
    height: 200,
    table: TABLE,
    children: (width: number) => <rect data-testid="mark" width={width} height={10} fill="var(--chart-1)" />,
  },
  decorators: [
    (Story) => (
      <div className="w-150 max-w-full rounded-card bg-card p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChartFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await waitFor(async () => await expect(canvas.getByRole("img", { name: LABEL })).toBeInTheDocument());
  },
};

export const Empty: Story = {
  args: { isEmpty: true, emptyMessage: "No jobseekers in this range." },
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId(DATA_TEST_ID.EMPTY)).toBeVisible();
    await expect(canvas.queryByTestId(DATA_TEST_ID.PLOT)).not.toBeInTheDocument();
  },
};

export const LoadingWithNoDataYet: Story = {
  name: "Loading, before any data has arrived",
  args: { isEmpty: true, isLoading: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Loading…")).toBeVisible();
  },
};

export const RefetchingWithDataAlreadyShown: Story = {
  name: "Loading, while holding the previous render",
  args: { isLoading: true },
  play: async ({ canvas }) => {
    await waitFor(
      async () => await expect(canvas.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveAttribute("aria-busy", "true")
    );
    await expect(canvas.getByTestId(DATA_TEST_ID.PLOT)).toBeInTheDocument();
  },
};

export const WithFooterAndOverlay: Story = {
  name: "With a legend footer and a tooltip overlay",
  args: {
    footer: <p className="pt-3 text-center text-sm text-muted-foreground">Legend goes here</p>,
    overlay: (width: number) => (
      <p className="absolute top-2 right-2 text-xs text-muted-foreground">{`overlay at ${width}px`}</p>
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Legend goes here")).toBeVisible();
    await waitFor(async () => await expect(canvas.getByText(/^overlay at [1-9]/)).toBeVisible());
  },
};

export const DataStaysReachableInATable: Story = {
  name: "Every plotted value stays reachable in a hidden table",
  play: async ({ canvas }) => {
    const table = within(canvas.getByTestId(DATA_TEST_ID.TABLE));
    await expect(table.getByRole("rowheader", { name: "Jul" })).toBeInTheDocument();
    await expect(table.getByRole("cell", { name: "63" })).toBeInTheDocument();
  },
};
