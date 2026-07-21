import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta = {
  component: Tabs,
  tags: ["ai-generated"],
  args: {
    defaultValue: "overview",
  },
  render: (args) => (
    <Tabs {...args} className="w-80">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="institutions">Institutions</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Overview panel content.</TabsContent>
      <TabsContent value="institutions">Institutions panel content.</TabsContent>
    </Tabs>
  ),
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Overview panel content.")).toBeVisible();
  },
};

export const SwitchTab: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Institutions" }));
    await expect(await canvas.findByText("Institutions panel content.")).toBeVisible();
  },
};
