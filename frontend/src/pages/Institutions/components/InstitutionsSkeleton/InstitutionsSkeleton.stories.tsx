import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { InstitutionsSkeleton } from "./InstitutionsSkeleton";

const meta = {
  component: InstitutionsSkeleton,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InstitutionsSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    // Announced as busy, with the shapes themselves hidden from screen readers.
    await expect(canvas.getByRole("status")).toHaveAttribute("aria-busy", "true");
    await expect(canvas.getByText("Loading…")).toBeInTheDocument();
  },
};

// A deployment with fewer modules has fewer columns to stand in for.
export const TwoModulesDeployed: Story = {
  args: { columns: 4, rows: 5 },
};
