import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { SkillsModal } from "./SkillsModal";

const SKILLS = [
  "Customer service",
  "Cash handling",
  "Inventory management",
  "Team coordination",
  "Bookkeeping",
  "Data entry",
];

const meta = {
  component: SkillsModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { open: true, name: "María González", skills: SKILLS, onOpenChange: () => {} },
} satisfies Meta<typeof SkillsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Shown: Story = {
  play: async ({ canvasElement }) => {
    // The dialog is portalled to the body, outside the story canvas.
    const modal = within(canvasElement.ownerDocument.body);
    await expect(modal.getByRole("heading", { name: "María González" })).toBeVisible();
    await expect(modal.getByText("Skills Report · 6 skills elicited")).toBeVisible();
  },
};

export const OneSkill: Story = {
  args: { skills: ["Customer service"] },
};

// Build Your Profile has not finished, so there is no report to show yet.
export const NotReady: Story = {
  args: { skills: [] },
  play: async ({ canvasElement }) => {
    const modal = within(canvasElement.ownerDocument.body);
    await expect(modal.getByRole("status")).toHaveTextContent("No skills to show");
  },
};
