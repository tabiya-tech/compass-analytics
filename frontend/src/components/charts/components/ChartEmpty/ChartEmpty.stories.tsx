import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { ChartEmpty, DATA_TEST_ID } from "./ChartEmpty";

const meta = {
  component: ChartEmpty,
  tags: ["autodocs"],
  args: {
    message: "No data to show for this selection.",
  },
  decorators: [
    (Story) => (
      <div className="w-110 max-w-full rounded-card bg-card">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChartEmpty>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No data to show for this selection.")).toBeVisible();
    await expect(canvas.getByRole("status")).toBeInTheDocument();
  },
};

export const LoadingCopy: Story = {
  name: "With a loading message",
  args: { message: "Loading…" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Loading…")).toBeVisible();
  },
};

export const IconIsDecorative: Story = {
  name: "Icon adds nothing for assistive tech",
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId(DATA_TEST_ID.ICON)).toHaveAttribute("aria-hidden", "true");
  },
};
