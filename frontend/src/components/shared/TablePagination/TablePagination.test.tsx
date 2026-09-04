import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/_test_utilities/test-utils";
import { TablePagination, DATA_TEST_ID } from "./TablePagination";

function offeredPages(): number[] {
  return screen.getAllByTestId(DATA_TEST_ID.PAGE_BUTTON).map((button) => Number(button.dataset.page));
}

function offeredSlotCount(): number {
  return screen.getAllByTestId(DATA_TEST_ID.PAGE_BUTTON).length + screen.queryAllByTestId(DATA_TEST_ID.ELLIPSIS).length;
}

describe("TablePagination", () => {
  it("should summarise which rows the current page covers", () => {
    // GIVEN a table on the second of three pages of fifty
    // WHEN rendered
    render(<TablePagination page={2} pageSize={50} total={128} onPageChange={vi.fn()} />);

    // THEN the reader is told where in the list they are
    expect(screen.getByTestId(DATA_TEST_ID.RANGE)).toHaveTextContent("Showing 51–100 of 128");
  });

  it("should render nothing when every row already fits on one page", () => {
    // GIVEN a table whose rows all fit on the page
    // WHEN rendered
    render(<TablePagination page={1} pageSize={50} total={12} onPageChange={vi.fn()} />);

    // THEN there is no pager to distract from the table
    expect(screen.queryByTestId(DATA_TEST_ID.CONTAINER)).not.toBeInTheDocument();
  });

  it("should render nothing when the table is empty", () => {
    // GIVEN a table with no rows, showing its own empty state
    // WHEN rendered
    render(<TablePagination page={1} pageSize={50} total={0} onPageChange={vi.fn()} />);

    // THEN the pager stays out of the way
    expect(screen.queryByTestId(DATA_TEST_ID.CONTAINER)).not.toBeInTheDocument();
  });

  it("should show a gap rather than words where pages are skipped", () => {
    // GIVEN a table with more pages than the pager can list
    // WHEN rendered
    render(<TablePagination page={20} pageSize={10} total={400} onPageChange={vi.fn()} />);

    // THEN the gap is three drawn dots rather than written copy
    const [firstGap] = screen.getAllByTestId(DATA_TEST_ID.ELLIPSIS);
    expect(firstGap).toHaveTextContent("");
    expect(firstGap.querySelectorAll("span")).toHaveLength(3);
    expect(screen.queryByText("More pages")).not.toBeInTheDocument();
  });

  it("should mark the current page for assistive tech", () => {
    // GIVEN a table on its second page
    // WHEN rendered
    render(<TablePagination page={2} pageSize={50} total={128} onPageChange={vi.fn()} />);

    // THEN only that page is announced as the current one
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Page 1" })).not.toHaveAttribute("aria-current");
  });

  it("should move to the page the reader picks", async () => {
    // GIVEN a table on its first page
    const onPageChange = vi.fn();
    render(<TablePagination page={1} pageSize={50} total={128} onPageChange={onPageChange} />);

    // WHEN the reader picks the third page
    await userEvent.click(screen.getByRole("button", { name: "Page 3" }));

    // THEN that page is requested
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("should step forwards and backwards one page at a time", async () => {
    // GIVEN a table on its second page
    const onPageChange = vi.fn();
    render(<TablePagination page={2} pageSize={50} total={128} onPageChange={onPageChange} />);

    // WHEN the reader steps to the next page
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));

    // THEN the page after it is requested
    expect(onPageChange).toHaveBeenCalledWith(3);

    // WHEN the reader steps back instead
    await userEvent.click(screen.getByRole("button", { name: "Previous page" }));

    // THEN the page before it is requested
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("should not offer a page before the first one", () => {
    // GIVEN a table on its first page
    // WHEN rendered
    render(<TablePagination page={1} pageSize={50} total={128} onPageChange={vi.fn()} />);

    // THEN stepping backwards is unavailable
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
  });

  it("should not offer a page after the last one", () => {
    // GIVEN a table on its last page
    // WHEN rendered
    render(<TablePagination page={3} pageSize={50} total={128} onPageChange={vi.fn()} />);

    // THEN stepping forwards is unavailable
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
  });

  it("should fall back to the last page when handed a page that no longer exists", async () => {
    // GIVEN a page number left over from before the list was filtered down
    const onPageChange = vi.fn();
    render(<TablePagination page={99} pageSize={50} total={128} onPageChange={onPageChange} />);

    // THEN the summary describes the last real page
    expect(screen.getByTestId(DATA_TEST_ID.RANGE)).toHaveTextContent("Showing 101–128 of 128");
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();

    // WHEN the reader steps back from there
    await userEvent.click(screen.getByRole("button", { name: "Previous page" }));

    // THEN they land on the page before the last, not somewhere off the end
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("should offer every page when they all fit alongside each other", () => {
    // GIVEN a table with no more pages than the pager has room for
    // WHEN rendered
    render(<TablePagination page={1} pageSize={10} total={50} onPageChange={vi.fn()} />);

    // THEN each one is a click away, with nothing skipped
    expect(offeredPages()).toEqual([1, 2, 3, 4, 5]);
    expect(screen.queryByTestId(DATA_TEST_ID.ELLIPSIS)).not.toBeInTheDocument();
  });

  it("should stay the same width whatever page the reader is on, so the table doesn't shift", () => {
    // GIVEN a table of forty pages
    const { rerender } = render(<TablePagination page={1} pageSize={10} total={400} onPageChange={vi.fn()} />);
    const expectedSlots = offeredSlotCount();

    // WHEN each page in turn is the current one
    for (const page of [2, 5, 12, 20, 33, 38, 40]) {
      rerender(<TablePagination page={page} pageSize={10} total={400} onPageChange={vi.fn()} />);

      // THEN the pager offers the same number of slots as it did on the first page
      expect(offeredSlotCount()).toBe(expectedSlots);
    }
  });

  it("should run the opening pages together when the reader is near the start", () => {
    // GIVEN a reader on the third page of forty
    // WHEN rendered
    render(<TablePagination page={3} pageSize={10} total={400} onPageChange={vi.fn()} />);

    // THEN the pages around them are unbroken, and the last is still one click away
    expect(offeredPages()).toEqual([1, 2, 3, 40]);
  });

  it("should run the closing pages together when the reader is near the end", () => {
    // GIVEN a reader on the second-to-last page of forty
    // WHEN rendered
    render(<TablePagination page={39} pageSize={10} total={400} onPageChange={vi.fn()} />);

    // THEN the pages around them are unbroken, and the first is still one click away
    expect(offeredPages()).toEqual([1, 38, 39, 40]);
  });

  it("should keep both ends reachable from the middle of a long table", () => {
    // GIVEN a reader halfway through forty pages
    // WHEN rendered
    render(<TablePagination page={20} pageSize={10} total={400} onPageChange={vi.fn()} />);

    // THEN their page sits between the first and last, with the runs either side skipped
    expect(offeredPages()).toEqual([1, 20, 40]);
    expect(screen.getAllByTestId(DATA_TEST_ID.ELLIPSIS)).toHaveLength(2);
  });

  it("should never skip a single page, which would cost a click to reach for no saving", () => {
    // GIVEN a table just long enough to need gaps
    const { rerender } = render(<TablePagination page={1} pageSize={10} total={60} onPageChange={vi.fn()} />);

    // WHEN each page in turn is the current one
    for (const page of [1, 2, 3, 4, 5, 6]) {
      rerender(<TablePagination page={page} pageSize={10} total={60} onPageChange={vi.fn()} />);

      // THEN every gap stands in for more than one page
      const shown = offeredPages();
      const gaps = shown.slice(1).map((offered, index) => offered - shown[index]);
      expect(gaps.filter((gap) => gap > 1).every((gap) => gap > 2)).toBe(true);
    }
  });

  it("should hide the skipped-page markers from assistive tech", () => {
    // GIVEN a table with more pages than the pager can list
    // WHEN rendered
    render(<TablePagination page={20} pageSize={50} total={2000} onPageChange={vi.fn()} />);

    // THEN each gap is decoration only, since the pages either side already convey it
    const [firstGap] = screen.getAllByTestId(DATA_TEST_ID.ELLIPSIS);
    expect(firstGap).toHaveAttribute("aria-hidden", "true");
  });
});
