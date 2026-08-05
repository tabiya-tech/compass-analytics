import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { FilterMenu, type FilterMenuProps } from "./FilterMenu";

const REGIONS = [
  { value: "lusaka", label: "Lusaka" },
  { value: "copperbelt", label: "Copperbelt" },
  { value: "southern", label: "Southern" },
  { value: "eastern", label: "Eastern" },
  { value: "central", label: "Central" },
];

// The menu is controlled, so the story owns the selection to keep the checkboxes interactive.
function ControlledFilterMenu({ selected, onSelectionChange, ...props }: Readonly<FilterMenuProps>) {
  const [value, setValue] = useState<readonly string[]>(selected);

  return (
    <FilterMenu
      {...props}
      selected={value}
      onSelectionChange={(next) => {
        setValue(next);
        onSelectionChange(next);
      }}
    />
  );
}

// Popover content is portalled to the body, so it lives outside the story canvas.
async function openMenu(canvasElement: HTMLElement) {
  await userEvent.click(within(canvasElement).getByRole("button", { name: "Filter by Region" }));
  const menu = within(document.body);
  // The popover fades in, so wait for the option group to settle before asserting on visibility.
  await waitFor(() => expect(menu.getByRole("group", { name: "Filter · Region" })).toBeVisible());
  return menu;
}

const meta = {
  component: FilterMenu,
  tags: ["autodocs"],
  render: (args) => <ControlledFilterMenu {...args} />,
  args: {
    label: "Region",
    options: REGIONS,
    selected: [],
    onSelectionChange: () => {},
  },
} satisfies Meta<typeof FilterMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoSelection: Story = {
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement);

    await expect(menu.getByRole("checkbox", { name: "Lusaka" })).not.toBeChecked();
    await expect(menu.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  },
};

export const PartialSelection: Story = {
  args: { selected: ["lusaka", "eastern"] },
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement);

    await expect(menu.getByRole("checkbox", { name: "Lusaka" })).toBeChecked();
    await expect(menu.getByRole("checkbox", { name: "Southern" })).not.toBeChecked();
    await expect(menu.getByText("2 selected")).toBeVisible();
  },
};

export const AllSelected: Story = {
  args: { selected: REGIONS.map((region) => region.value) },
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement);

    for (const region of REGIONS) {
      await expect(menu.getByRole("checkbox", { name: region.label })).toBeChecked();
    }
    await expect(menu.getByText("5 selected")).toBeVisible();
  },
};

export const NoOptions: Story = {
  args: { options: [] },
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement);

    await expect(menu.getByText("No filter options available")).toBeVisible();
    await expect(menu.queryByRole("checkbox")).not.toBeInTheDocument();
  },
};

export const TogglingAnOption: Story = {
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement);

    await userEvent.click(menu.getByRole("checkbox", { name: "Copperbelt" }));

    await expect(menu.getByRole("checkbox", { name: "Copperbelt" })).toBeChecked();
    await expect(menu.getByText("1 selected")).toBeVisible();
  },
};

// How the per-module filters sit in the Jobseekers table headers: funnel icon only.
export const IconOnly: Story = {
  args: {
    label: "Build Your Profile",
    showLabel: false,
    options: [
      { value: "completed", label: "Completed" },
      { value: "in-progress", label: "In progress" },
      { value: "not-started", label: "Not started" },
    ],
    selected: ["completed"],
  },
  render: (args) => (
    <div className="flex items-center gap-1">
      <span className="font-mono text-xs tracking-[2px] text-muted-foreground uppercase">{args.label}</span>
      <ControlledFilterMenu {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Filter by Build Your Profile" });

    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveTextContent("");
  },
};
