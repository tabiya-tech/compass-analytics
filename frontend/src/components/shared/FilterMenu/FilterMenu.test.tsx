import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/_test_utilities/test-utils";
import { FilterMenu, type FilterMenuOption } from "./FilterMenu";

const REGIONS: FilterMenuOption[] = [
  { value: "lusaka", label: "Lusaka" },
  { value: "copperbelt", label: "Copperbelt" },
  { value: "southern", label: "Southern" },
];

async function renderAndOpenMenu(selected: string[] = [], options: FilterMenuOption[] = REGIONS) {
  const onSelectionChange = vi.fn();
  render(<FilterMenu label="Region" options={options} selected={selected} onSelectionChange={onSelectionChange} />);
  await userEvent.click(screen.getByRole("button", { name: "Filter by Region" }));
  return { onSelectionChange };
}

describe("FilterMenu", () => {
  it("should keep the options hidden until the menu is opened", async () => {
    // GIVEN a closed filter menu
    render(<FilterMenu label="Region" options={REGIONS} selected={[]} onSelectionChange={vi.fn()} />);

    // THEN no options are shown
    expect(screen.queryByRole("checkbox", { name: "Lusaka" })).not.toBeInTheDocument();

    // WHEN the trigger is clicked
    await userEvent.click(screen.getByRole("button", { name: "Filter by Region" }));

    // THEN every option is shown
    expect(screen.getByRole("checkbox", { name: "Lusaka" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Copperbelt" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Southern" })).toBeInTheDocument();
  });

  it("should show nothing selected and no way to clear when the selection is empty", async () => {
    // GIVEN an open menu with nothing selected
    await renderAndOpenMenu();

    // THEN no option is ticked and there's nothing to clear
    expect(screen.getByRole("checkbox", { name: "Lusaka" })).not.toBeChecked();
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  });

  it("should tick only the selected options and report how many are selected", async () => {
    // GIVEN an open menu with two of three regions selected
    await renderAndOpenMenu(["lusaka", "southern"]);

    // THEN those two are ticked, the third isn't, and the count reflects the selection
    expect(screen.getByRole("checkbox", { name: "Lusaka" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Southern" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Copperbelt" })).not.toBeChecked();
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    // AND the trigger itself carries a badge with the same count
    expect(screen.getByRole("button", { name: "Filter by Region" })).toHaveTextContent("2");
  });

  it("should give the open menu a name of its own, since Radix exposes it as a dialog", async () => {
    // GIVEN an open menu
    await renderAndOpenMenu();

    // THEN the menu surface is reachable as a named dialog, not just its fieldset
    expect(screen.getByRole("dialog", { name: "Filter by Region" })).toBeInTheDocument();
  });

  it("should add a region to the selection when an unticked option is clicked", async () => {
    // GIVEN an open menu with one region already selected
    const { onSelectionChange } = await renderAndOpenMenu(["lusaka"]);

    // WHEN ticking another region
    await userEvent.click(screen.getByRole("checkbox", { name: "Southern" }));

    // THEN the callback receives the full new selection
    expect(onSelectionChange).toHaveBeenCalledWith(["lusaka", "southern"]);
  });

  it("should remove a region from the selection when a ticked option is clicked", async () => {
    // GIVEN an open menu with two regions selected
    const { onSelectionChange } = await renderAndOpenMenu(["lusaka", "southern"]);

    // WHEN unticking one of them
    await userEvent.click(screen.getByRole("checkbox", { name: "Lusaka" }));

    // THEN the callback receives the selection without it
    expect(onSelectionChange).toHaveBeenCalledWith(["southern"]);
  });

  it("should empty the selection when Clear is clicked", async () => {
    // GIVEN an open menu with every region selected
    const { onSelectionChange } = await renderAndOpenMenu(REGIONS.map((region) => region.value));

    // WHEN clicking Clear
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    // THEN the callback receives an empty selection
    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it("should drop the visible label but keep the accessible name when used as a column filter", async () => {
    // GIVEN a column-header filter, which shows only its funnel icon
    render(<FilterMenu label="Region" options={REGIONS} selected={[]} onSelectionChange={vi.fn()} showLabel={false} />);

    // THEN the trigger carries no visible text, but is still reachable by name
    const trigger = screen.getByRole("button", { name: "Filter by Region" });
    expect(trigger).toHaveTextContent("");

    // WHEN it is clicked
    await userEvent.click(trigger);

    // THEN the same options open, under a heading that names the filter
    expect(screen.getByRole("group", { name: "Filter · Region" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Lusaka" })).toBeInTheDocument();
  });

  it("should explain that there is nothing to filter by when the options list is empty", async () => {
    // GIVEN an open menu with no options
    await renderAndOpenMenu([], []);

    // THEN the empty message shows instead of any checkbox
    expect(screen.getByText("No filter options available")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
