import { describe, expect, it } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import { ChartEmpty, DATA_TEST_ID } from "./ChartEmpty";

describe("ChartEmpty", () => {
  it("should show the given message", () => {
    // GIVEN a message explaining why there is nothing to plot
    const givenMessage = "No jobseekers in this range.";

    // WHEN it is rendered
    render(<ChartEmpty message={givenMessage} />);

    // THEN the message is shown
    expect(screen.getByText(givenMessage)).toBeInTheDocument();
  });

  it("should announce itself to assistive tech as a status, not a silent empty region", () => {
    // GIVEN an empty state
    // WHEN it is rendered
    render(<ChartEmpty message="No data to show for this selection." />);

    // THEN it is reachable as a status region, and its icon adds nothing extra
    expect(screen.getByRole("status")).toBe(screen.getByTestId(DATA_TEST_ID.CONTAINER));
    expect(screen.getByTestId(DATA_TEST_ID.ICON)).toHaveAttribute("aria-hidden", "true");
  });
});
