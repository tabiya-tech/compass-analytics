import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { LoginMethodPanel } from "./LoginMethodPanel";

const meta = {
  component: LoginMethodPanel,
  tags: ["autodocs"],
  args: {
    loginMethods: [
      { method: "google", users: 2471 },
      { method: "email", users: 1647 },
    ],
    averageLoginsPerUser: 2.2,
  },
  decorators: [
    (Story) => (
      <div className="w-140 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LoginMethodPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GoogleAndEmail: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelectorAll(".recharts-sector")).toHaveLength(2);
    await expect(canvas.getByText("2.2")).toBeVisible();

    const legend = within(canvas.getByRole("list"));
    await expect(legend.getByText("60%")).toBeVisible();
    await expect(legend.getByText("40%")).toBeVisible();
  },
};

export const FilteredToOneMethod: Story = {
  args: { loginMethods: [{ method: "google", users: 2471 }], averageLoginsPerUser: 2.4 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll(".recharts-sector")).toHaveLength(1);
  },
};

export const Empty: Story = {
  args: { loginMethods: [], averageLoginsPerUser: 0 },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No data to show for this selection.")).toBeVisible();
  },
};
