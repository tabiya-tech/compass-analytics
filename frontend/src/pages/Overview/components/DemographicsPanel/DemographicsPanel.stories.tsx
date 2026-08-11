import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import type { Demographics } from "@/pages/Overview/overview.types";
import { DemographicsPanel } from "./DemographicsPanel";

const DEMOGRAPHICS: Demographics = {
  gender: [
    { id: "women", users: 2141 },
    { id: "men", users: 1689 },
    { id: "undisclosed", users: 288 },
  ],
  ageBands: [
    { id: "18-24", users: 993 },
    { id: "25-34", users: 780 },
    { id: "35-44", users: 378 },
    { id: "45-plus", users: 213 },
  ],
  educationLevels: [
    { id: "primary", users: 331 },
    { id: "secondary", users: 1135 },
    { id: "tertiary", users: 898 },
  ],
  regions: [
    { id: "lusaka", label: "Lusaka", users: 419 },
    { id: "copperbelt", label: "Copperbelt", users: 304 },
    { id: "southern", label: "Southern", users: 435 },
    { id: "eastern", label: "Eastern", users: 643 },
    { id: "central", label: "Central", users: 563 },
  ],
};

const meta = {
  component: DemographicsPanel,
  tags: ["autodocs"],
  args: { demographics: DEMOGRAPHICS },
  decorators: [
    (Story) => (
      <div className="w-260 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DemographicsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullProfile: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelectorAll(".recharts-sector")).toHaveLength(3);
    await expect(canvas.getByRole("list", { name: "Age band" })).toBeVisible();
    await expect(canvas.getByRole("list", { name: "Education" })).toBeVisible();
    await expect(canvas.getByRole("list", { name: "Region" })).toBeVisible();
  },
};

export const WithoutRegions: Story = {
  args: { demographics: { ...DEMOGRAPHICS, regions: [] } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Region")).toBeVisible();
    await expect(canvas.getByText("No data to show for this selection.")).toBeVisible();
  },
};

export const Empty: Story = {
  args: { demographics: { gender: [], ageBands: [], educationLevels: [], regions: [] } },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText("No data to show for this selection.")).toHaveLength(4);
  },
};
