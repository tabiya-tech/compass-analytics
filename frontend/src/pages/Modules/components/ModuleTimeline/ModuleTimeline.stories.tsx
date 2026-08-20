import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { MODULE_IDS } from "@/access/AccessContext";
import { ModuleTimeline, DATA_TEST_ID } from "./ModuleTimeline";

const WHOLE_SUITE = [
  { id: MODULE_IDS.BUILD_YOUR_PROFILE, startedPercentage: 44 },
  { id: MODULE_IDS.JOB_READINESS, startedPercentage: 34 },
  { id: MODULE_IDS.CAREER_EXPLORER, startedPercentage: 18 },
  { id: MODULE_IDS.JOBS, startedPercentage: 26 },
];

const meta = {
  component: ModuleTimeline,
  tags: ["autodocs"],
  args: { modules: WHOLE_SUITE },
  decorators: [
    (Story) => (
      <div className="w-260 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ModuleTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByTestId(DATA_TEST_ID.STEP)).toHaveLength(4);
    await expect(canvas.getByText("44% started")).toBeVisible();
  },
};

export const JumpsToAModule: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Jump to Career Explorer" }));
    await expect(canvas.getByRole("button", { name: "Jump to Career Explorer" })).toHaveAttribute(
      "aria-current",
      "true"
    );
  },
};

export const TwoModuleDeployment: Story = {
  args: { modules: WHOLE_SUITE.slice(0, 2) },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByTestId(DATA_TEST_ID.STEP)).toHaveLength(2);
  },
};
