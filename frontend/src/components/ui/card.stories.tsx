import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";
import { Button } from "./button";

const meta = {
  component: Card,
  tags: ["ai-generated"],
  render: (args) => (
    <Card {...args} className="w-80">
      <CardHeader>
        <CardTitle>Reach</CardTitle>
        <CardDescription>Cumulative jobseekers this quarter</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold text-foreground">12,480</p>
      </CardContent>
      <CardFooter>
        <Button size="sm">View details</Button>
      </CardFooter>
    </Card>
  ),
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Reach")).toBeVisible();
    await expect(canvas.getByText("12,480")).toBeVisible();
  },
};
