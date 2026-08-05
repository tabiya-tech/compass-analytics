import { describe, expect, it, vi } from "vitest";
import { Users } from "lucide-react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/_test_utilities/test-utils";
import { EmptyState, DATA_TEST_ID } from "./EmptyState";

describe("EmptyState", () => {
  it("should announce the message and offer no action by default", () => {
    // GIVEN an empty list with only a message
    // WHEN rendered
    render(<EmptyState message="No jobseekers match these filters." />);

    // THEN the message is announced and there's nothing to click
    expect(screen.getByRole("status")).toHaveTextContent("No jobseekers match these filters.");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("should render a default icon when no icon is provided", () => {
    // GIVEN an empty list with no icon of its own
    // WHEN rendered
    render(<EmptyState message="No results." />);

    // THEN the fallback icon still fills the slot
    expect(screen.getByTestId(DATA_TEST_ID.ICON).querySelector("svg")).toBeInTheDocument();
  });

  it("should hide the icon from assistive tech, since the message alone conveys the state", () => {
    // GIVEN an empty list with an icon
    // WHEN rendered
    render(<EmptyState message="No results." />);

    // THEN the icon slot is hidden from screen readers
    expect(screen.getByTestId(DATA_TEST_ID.ICON)).toHaveAttribute("aria-hidden", "true");
  });

  it("should render the icon passed into the icon slot", () => {
    // GIVEN an empty list with its own icon
    // WHEN rendered
    render(<EmptyState message="No institutions yet." icon={<Users data-testid="icon" />} />);

    // THEN that icon is the one in the slot
    expect(screen.getByTestId(DATA_TEST_ID.ICON).querySelector("svg")).toHaveAttribute("data-testid", "icon");
  });

  it("should call the action when its button is clicked", async () => {
    // GIVEN an empty list offering a way to clear the filters
    const onClick = vi.fn();
    render(<EmptyState message="No results." action={{ label: "Clear filters", onClick }} />);

    // WHEN clicking the action
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    // THEN the action runs
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
