import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { FiltersProvider } from "@/filters/FiltersContext";
import { createInitialFilters } from "@/filters/filters";
import type { ReachPoint } from "@/pages/Overview/overview.types";
import { ReachOverTimePanel } from "./ReachOverTimePanel";

const MONTHLY_REACH: ReachPoint[] = [
  { period: "2025-07", newUsers: 155, returningUsers: 63 },
  { period: "2025-08", newUsers: 96, returningUsers: 41 },
  { period: "2025-09", newUsers: 160, returningUsers: 66 },
  { period: "2025-10", newUsers: 152, returningUsers: 58 },
  { period: "2025-11", newUsers: 258, returningUsers: 105 },
  { period: "2025-12", newUsers: 118, returningUsers: 51 },
  { period: "2026-01", newUsers: 205, returningUsers: 108 },
  { period: "2026-02", newUsers: 128, returningUsers: 52 },
  { period: "2026-03", newUsers: 349, returningUsers: 178 },
  { period: "2026-04", newUsers: 261, returningUsers: 116 },
  { period: "2026-05", newUsers: 382, returningUsers: 209 },
  { period: "2026-06", newUsers: 157, returningUsers: 63 },
  { period: "2026-07", newUsers: 62, returningUsers: 21 },
];

const DAILY_REACH: ReachPoint[] = Array.from({ length: 14 }, (_, index) => ({
  period: `2026-06-${String(index + 1).padStart(2, "0")}`,
  newUsers: 12 + index * 3,
  returningUsers: 4 + index,
}));

const FIXED_FILTERS = createInitialFilters(new Date(2026, 6, 7));

const meta = {
  component: ReachOverTimePanel,
  tags: ["autodocs"],
  args: {
    reachSeries: MONTHLY_REACH,
    granularity: "month",
  },
  decorators: [
    (Story) => (
      <FiltersProvider initialFilters={FIXED_FILTERS}>
        <div className="w-200 max-w-full">
          <Story />
        </div>
      </FiltersProvider>
    ),
  ],
} satisfies Meta<typeof ReachOverTimePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ByMonth: Story = {
  play: async ({ canvas, canvasElement }) => {
    await waitFor(async () =>
      expect(canvasElement.querySelectorAll(".recharts-rectangle")).toHaveLength(MONTHLY_REACH.length * 2)
    );

    await expect(canvas.getByRole("heading", { level: 2, name: "Reach over time" })).toBeVisible();
    await expect(canvas.getByText("New and returning users, by month")).toBeVisible();
  },
};

export const ByDay: Story = {
  args: { reachSeries: DAILY_REACH, granularity: "day" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("New and returning users, by day")).toBeVisible();

    const table = within(canvas.getByRole("table", { name: "New and returning users by day" }));
    await expect(table.getByRole("rowheader", { name: "1 Jun" })).toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: { reachSeries: [], isLoading: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "Loading…" })).toBeVisible();
  },
};

export const Empty: Story = {
  args: { reachSeries: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No data to show for this selection.")).toBeVisible();
  },
};
