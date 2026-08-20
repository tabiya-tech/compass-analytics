import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Funnel, DATA_TEST_ID } from "./Funnel";

// Placeholder data throughout — the real copy is not settled.
const STAGES = [
  { id: "intro", label: "Intro", value: 1798 },
  { id: "experiences", label: "Experiences", value: 1546 },
  { id: "skills", label: "Skills", value: 1150 },
  { id: "review", label: "Review", value: 718 },
  { id: "completed", label: "Completed", value: 502 },
];

const meta = {
  component: Funnel,
  tags: ["autodocs"],
  args: {
    label: "Conversation funnel",
    stages: STAGES,
    valueCaption: "Reached stage · % of those who started",
    dropOffCaption: "Drop-off",
  },
  decorators: [
    (Story) => (
      <div className="w-240 max-w-full rounded-card bg-card p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Funnel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByTestId(DATA_TEST_ID.STAGE)).toHaveLength(5);
    await expect(canvas.getAllByTestId(DATA_TEST_ID.BAR)[0]).toHaveTextContent("100%");
    await expect(canvas.getAllByTestId(DATA_TEST_ID.DROP_OFF)[1]).toHaveTextContent("−252");
  },
};

/** Every stage keeps everyone — the funnel is a straight column, with no drop-off reported anywhere. */
export const NoDropOff: Story = {
  args: {
    stages: STAGES.map((stage) => ({ ...stage, value: 1798 })),
  },
  play: async ({ canvas }) => {
    const dropOffs = canvas.getAllByTestId(DATA_TEST_ID.DROP_OFF);
    await expect(dropOffs.every((element) => element.textContent === "")).toBe(true);
  },
};

/** A short funnel still runs the full light-to-dark ramp, so the taper reads the same way. */
export const ThreeStages: Story = {
  args: { stages: STAGES.slice(0, 3) },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByTestId(DATA_TEST_ID.STAGE)).toHaveLength(3);
  },
};

/** A near-total drop-off still leaves a readable bar rather than a sliver. */
export const SteepDropOff: Story = {
  args: {
    stages: [
      { id: "intro", label: "Intro", value: 4000 },
      { id: "experiences", label: "Experiences", value: 900 },
      { id: "completed", label: "Completed", value: 40 },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByTestId(DATA_TEST_ID.BAR)[2]).toHaveTextContent("40");
  },
};

export const Empty: Story = {
  args: { stages: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No data to show for this selection.")).toBeVisible();
  },
};

export const Loading: Story = {
  args: { stages: [], isLoading: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Loading…")).toBeVisible();
  },
};
