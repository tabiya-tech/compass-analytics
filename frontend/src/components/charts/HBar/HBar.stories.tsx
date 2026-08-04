import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { HBar, DATA_TEST_ID } from "./HBar";
import { seriesColorAt } from "@/components/charts/chart-palette";

// Placeholder data throughout — the real copy is not settled.
const CATEGORIES = [
  { id: "a", label: "Category A", value: 188 },
  { id: "b", label: "Category B", value: 152 },
  { id: "c", label: "Category C", value: 137 },
  { id: "d", label: "Category D", value: 130 },
  { id: "e", label: "Category E", value: 116 },
];

const BANDS = [
  { id: "band-1", label: "Band 1", value: 993 },
  { id: "band-2", label: "Band 2", value: 780 },
  { id: "band-3", label: "Band 3", value: 378 },
  { id: "band-4", label: "Band 4", value: 213 },
];

const LEVELS = [
  { id: "level-1", label: "Level 1", value: 331 },
  { id: "level-2", label: "Level 2", value: 1135 },
  { id: "level-3", label: "Level 3", value: 898 },
];

const GROUPS = [
  { id: "group-1", label: "Group 1", value: 419 },
  { id: "group-2", label: "Group 2", value: 304 },
  { id: "group-3", label: "Group 3", value: 435 },
  { id: "group-4", label: "Group 4", value: 643 },
  { id: "group-5", label: "Group 5", value: 563 },
];

const meta = {
  component: HBar,
  tags: ["autodocs"],
  args: {
    label: "Values by category",
    items: CATEGORIES,
  },
  decorators: [
    (Story) => (
      <div className="w-140 max-w-full rounded-card bg-card p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    // A read-only ranking: the label and value are already beside every bar,
    // so there is nothing a click would reveal.
    await expect(canvas.getAllByTestId(DATA_TEST_ID.ROW)).toHaveLength(CATEGORIES.length);
    await expect(canvas.queryAllByRole("button")).toHaveLength(0);
    await expect(canvas.getByText("Category A")).toBeVisible();
    // The value sits outside the bar, where a short bar can't clip it.
    await expect(canvas.getByText("188")).toBeVisible();
  },
};

// With no visible heading the list is named for assistive tech instead, so the
// breakdown still has a name when the surrounding card supplies the title.
export const WithoutHeading: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.queryByTestId(DATA_TEST_ID.HEADING)).not.toBeInTheDocument();
    await expect(canvas.getByRole("list", { name: "Values by category" })).toBeInTheDocument();
  },
};

export const WithHeading: Story = {
  args: { label: "Band", items: BANDS, showLabel: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId(DATA_TEST_ID.HEADING)).toHaveTextContent("Band");
    // Named by the heading rather than by a duplicate aria-label.
    await expect(canvas.getByRole("list", { name: "Band" })).toBeInTheDocument();
  },
};

// Scaled against a total rather than the largest row, so the bars read as
// shares of the whole population.
export const AgainstAnExplicitMax: Story = {
  args: {
    label: "Values by band",
    items: BANDS,
    max: 2364,
  },
  play: async ({ canvas }) => {
    const [first] = canvas.getAllByTestId(DATA_TEST_ID.BAR);

    await expect(Number(first.getAttribute("aria-valuenow"))).toBeCloseTo(42, 0);
  },
};

// One breakdown per color slot, so groups sitting side by side stay
// distinguishable.
export const SeveralBreakdowns: Story = {
  name: "Several breakdowns, one color each",
  render: () => (
    <div className="grid gap-8 sm:grid-cols-2">
      <HBar label="Band" items={BANDS} color={seriesColorAt(0)} showLabel />
      <HBar label="Level" items={LEVELS} color={seriesColorAt(1)} showLabel />
      <HBar label="Group" items={GROUPS} color={seriesColorAt(2)} showLabel />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByTestId(DATA_TEST_ID.HEADING)).toHaveLength(3);
    await expect(canvas.getByRole("list", { name: "Level" })).toBeInTheDocument();
  },
};

export const Empty: Story = {
  args: { items: [] },
  play: async ({ canvas }) => {
    const empty = canvas.getByTestId(DATA_TEST_ID.EMPTY);

    await expect(within(empty).getByRole("status")).toBeVisible();
  },
};
