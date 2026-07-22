import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { LanguageSwitcher } from "./LanguageSwitcher";

const meta = {
  title: "i18n/LanguageSwitcher",
  component: LanguageSwitcher,
  tags: ["autodocs"],
  render: () => (
    <div style={{ width: 220, background: "var(--tabiya-blue)", padding: "1rem", borderRadius: "var(--radius-sm)" }}>
      <LanguageSwitcher />
    </div>
  ),
} satisfies Meta<typeof LanguageSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("combobox", { name: "Language" })).toBeVisible();
  },
};
