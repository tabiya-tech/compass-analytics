import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { TimeFilterBar } from "./time-filter-bar";
import { FiltersProvider } from "@/filters/FiltersContext";
import { createInitialFilters, deriveGranularity } from "@/filters/filters";

const GIVEN_TODAY = new Date(2026, 5, 15);

function withRange(start: string, end: string) {
  const dateRange = { start, end };
  return (Story: () => React.ReactElement) => (
    <FiltersProvider
      initialFilters={{ ...createInitialFilters(GIVEN_TODAY), dateRange, granularity: deriveGranularity(dateRange) }}
    >
      <Story />
    </FiltersProvider>
  );
}

const meta = {
  title: "Filters/TimeFilterBar",
  component: TimeFilterBar,
  tags: ["autodocs"],
} satisfies Meta<typeof TimeFilterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DayGranularity: Story = {
  decorators: [withRange("2026-06-01", "2026-06-20")],
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Grouped by day")).toBeVisible();
  },
};

export const WeekGranularity: Story = {
  decorators: [withRange("2026-01-01", "2026-03-01")],
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Grouped by week")).toBeVisible();
  },
};

export const MonthGranularity: Story = {
  decorators: [withRange("2025-01-01", "2026-06-01")],
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Grouped by month")).toBeVisible();
  },
};

export const BareDatesForCard: Story = {
  args: { showLabels: false, showGranularity: false },
  decorators: [withRange("2025-07-08", "2026-07-07")],
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Start date")).toBeVisible();
    await expect(canvas.queryByText(/Grouped by/)).not.toBeInTheDocument();
  },
};
