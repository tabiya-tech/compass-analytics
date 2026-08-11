import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Button } from "@/components/ui/button";
import { Panel, DATA_TEST_ID } from "./Panel";

const meta = {
  component: Panel,
  tags: ["autodocs"],
  args: {
    title: "Reach over time",
    children: (
      <div className="grid h-40 place-items-center rounded-sm bg-muted text-sm text-muted-foreground">Body</div>
    ),
  },
  decorators: [
    (Story) => (
      <div className="w-160 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 2, name: "Reach over time" })).toBeVisible();
  },
};

export const WithDescription: Story = {
  args: { description: "New and returning users, by month" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("New and returning users, by month")).toBeVisible();
  },
};

export const WithOwnControls: Story = {
  args: {
    description: "New and returning users, by month",
    action: (
      <Button variant="outline" size="sm">
        Change dates
      </Button>
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId(DATA_TEST_ID.ACTION)).toContainElement(
      canvas.getByRole("button", { name: "Change dates" })
    );
  },
};

export const NarrowPanelWrapsItsControls: Story = {
  args: {
    description: "New and returning users, by month",
    action: (
      <Button variant="outline" size="sm">
        Change dates
      </Button>
    ),
  },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    const title = canvas.getByRole("heading", { level: 2 }).getBoundingClientRect();
    const action = canvas.getByTestId(DATA_TEST_ID.ACTION).getBoundingClientRect();

    await expect(action.top).toBeGreaterThanOrEqual(title.bottom);
  },
};

export const WithFootnote: Story = {
  args: {
    title: "How they log in",
    description: "Share of users by login method",
    footnote: "Center figure = avg logins / user",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Center figure = avg logins / user")).toBeVisible();
  },
};
