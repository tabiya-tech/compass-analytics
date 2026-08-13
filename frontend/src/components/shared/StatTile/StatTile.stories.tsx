import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { ScanSearch, Timer } from "lucide-react";
import { StatTile, DATA_TEST_ID } from "./StatTile";

const meta = {
  component: StatTile,
  tags: ["autodocs"],
  args: {
    label: "Notebooks published",
    value: "812",
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BareValue: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Notebooks published")).toBeVisible();
    await expect(canvas.getByText("812")).toBeVisible();
  },
};

export const WithUpwardTrend: Story = {
  args: { trend: { value: 18, label: "vs. last sprint" } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Up 18%")).toBeInTheDocument();
    await expect(canvas.getByText("vs. last sprint")).toBeVisible();
  },
};

export const WithDownwardTrend: Story = {
  args: { trend: { value: -24, label: "since the last release" } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Down 24%")).toBeInTheDocument();
    await expect(canvas.getByText("since the last release")).toBeVisible();
  },
};

export const WithFlatTrend: Story = {
  args: { trend: { value: 0 } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No change")).toBeInTheDocument();
  },
};

export const WithIconAndCaption: Story = {
  args: {
    label: "Median time on task",
    value: "6m 40s",
    icon: <Timer />,
    caption: "across 3,204 sessions this week",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("across 3,204 sessions this week")).toBeVisible();
  },
};

// How the headline tiles read on the Institutions screen: dark, value first, no label.
export const InverseTone: Story = {
  args: {
    label: undefined,
    value: "80,193",
    caption: "Jobseekers reached across the portfolio",
    tone: "inverse",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("80,193")).toBeVisible();
    await expect(canvas.getByText("Jobseekers reached across the portfolio")).toBeVisible();
    await expect(canvas.queryByTestId(DATA_TEST_ID.LABEL)).not.toBeInTheDocument();
  },
};

function SparklinePlaceholder() {
  return (
    <svg viewBox="0 0 80 24" aria-hidden="true" className="h-6 w-20">
      <polyline points="0,20 16,16 32,17 48,9 64,6 80,3" fill="none" strokeWidth="2" className="stroke-green-2" />
    </svg>
  );
}

export const WithSparkline: Story = {
  args: {
    icon: <ScanSearch />,
    trend: { value: -24, label: "since the last release" },
    sparkline: <SparklinePlaceholder />,
  },
  play: async ({ canvas }) => {
    const value = canvas.getByText("812");
    const sparkline = canvas.getByTestId(DATA_TEST_ID.SPARKLINE);
    await expect(value.parentElement).toContainElement(sparkline);
  },
};
