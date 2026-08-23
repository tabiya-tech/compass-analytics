import { describe, expect, it } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import { DATA_TEST_ID, JobseekersSkeleton } from "./JobseekersSkeleton";

const GIVEN_DEFAULT_ROWS = 8;

describe("JobseekersSkeleton", () => {
  it("should tell a screen reader the roster is still loading", () => {
    // GIVEN a roster that has not arrived yet
    // WHEN the placeholder is rendered
    render(<JobseekersSkeleton />);

    // THEN the wait is announced once, as a live status
    const actualStatus = screen.getByRole("status");
    expect(actualStatus).toHaveTextContent("Loading…");
    // AND the region reports itself as busy, so the announcement is not read as final content
    expect(actualStatus).toHaveAttribute("aria-busy", "true");
  });

  it("should hide the placeholder shapes from a screen reader, leaving only the announcement", () => {
    // GIVEN a rendered placeholder
    render(<JobseekersSkeleton />);

    // WHEN its shapes are inspected
    const actualRows = screen.getAllByTestId(DATA_TEST_ID.ROW);

    // THEN every decorative block is hidden, so the wait is announced once and not row by row
    for (const row of actualRows) {
      expect(row.closest("[aria-hidden='true']")).not.toBeNull();
    }
  });

  it("should hold open a table's worth of rows by default", () => {
    // GIVEN no row count asked for
    // WHEN the placeholder is rendered
    render(<JobseekersSkeleton />);

    // THEN a full page of rows is held open, so the screen does not jump when the roster lands
    expect(screen.getAllByTestId(DATA_TEST_ID.ROW)).toHaveLength(GIVEN_DEFAULT_ROWS);
  });

  it("should hold open exactly the rows and columns the screen expects", () => {
    // GIVEN a deployment running fewer modules, on a shorter page
    const givenRows = 3;
    const givenColumns = 4;

    // WHEN the placeholder is asked for that shape
    render(<JobseekersSkeleton rows={givenRows} columns={givenColumns} />);

    // THEN it holds open that many rows
    const actualRows = screen.getAllByTestId(DATA_TEST_ID.ROW);
    expect(actualRows).toHaveLength(givenRows);
    // AND each row stands in for the avatar plus one block per column
    expect(actualRows[0].querySelectorAll("[data-slot='skeleton']")).toHaveLength(givenColumns + 1);
  });

  it("should render nothing but the announcement when there are no rows to hold open", () => {
    // GIVEN a placeholder asked for no rows
    // WHEN it is rendered
    render(<JobseekersSkeleton rows={0} />);

    // THEN there are no rows, and the wait is still announced
    expect(screen.queryAllByTestId(DATA_TEST_ID.ROW)).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("should let the screen place it, keeping its own layout", () => {
    // GIVEN a screen that positions the placeholder itself
    const givenClassName = "mt-10";

    // WHEN the placeholder is rendered with that class
    render(<JobseekersSkeleton className={givenClassName} />);

    // THEN the class is carried through alongside the placeholder's own layout
    const actualContainer = screen.getByTestId(DATA_TEST_ID.CONTAINER);
    expect(actualContainer).toHaveClass(givenClassName);
    expect(actualContainer).toHaveClass("grid");
  });
});
