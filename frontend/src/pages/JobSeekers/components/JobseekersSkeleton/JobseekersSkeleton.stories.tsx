import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { DATA_TEST_ID, JobseekersSkeleton } from "./JobseekersSkeleton";

const meta = {
  component: JobseekersSkeleton,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof JobseekersSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    // The visible skeleton is decorative; the loading state is announced by the status region alone.
    await expect(canvas.getByRole("status")).toHaveTextContent("Loading…");
    await expect(canvas.getAllByTestId(DATA_TEST_ID.ROW)).toHaveLength(8);
  },
};

// A deployment running one module needs fewer columns held open.
export const NarrowRoster: Story = {
  args: { columns: 4, rows: 5 },
};
