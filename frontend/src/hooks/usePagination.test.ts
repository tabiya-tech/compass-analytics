import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePagination } from "./usePagination";

const UNBOUNDED = Number.POSITIVE_INFINITY;

describe("usePagination", () => {
  it("should open on the first page", () => {
    // GIVEN a freshly loaded list
    // WHEN the hook is first rendered
    const { result } = renderHook(() => usePagination({ listIdentity: "unfiltered", pageCount: UNBOUNDED }));

    // THEN the reader starts at the beginning
    expect(result.current.page).toBe(1);
  });

  it("should move to the page the reader asks for", () => {
    // GIVEN a list on its first page
    const { result } = renderHook(() => usePagination({ listIdentity: "unfiltered", pageCount: UNBOUNDED }));

    // WHEN they ask for the third
    act(() => result.current.setPage(3));

    // THEN that is the page in play
    expect(result.current.page).toBe(3);
  });

  it("should send the reader back to the first page when the list is renumbered", () => {
    // GIVEN a reader on the third page
    const { result, rerender } = renderHook(
      ({ listIdentity }) => usePagination({ listIdentity, pageCount: UNBOUNDED }),
      { initialProps: { listIdentity: "unfiltered" } }
    );
    act(() => result.current.setPage(3));

    // WHEN a search renumbers every page
    rerender({ listIdentity: "searching for something" });

    // THEN they are back at the beginning, rather than on a page that may no longer exist
    expect(result.current.page).toBe(1);
  });

  it("should leave the page alone on a render that doesn't change the list", () => {
    // GIVEN a reader on the second page
    const { result, rerender } = renderHook(
      ({ listIdentity }) => usePagination({ listIdentity, pageCount: UNBOUNDED }),
      { initialProps: { listIdentity: "unfiltered" } }
    );
    act(() => result.current.setPage(2));

    // WHEN the component re-renders with the same list identity
    rerender({ listIdentity: "unfiltered" });

    // THEN the page they picked is undisturbed
    expect(result.current.page).toBe(2);
  });

  it("should pull the reader back to the last real page once the total shrinks below it", () => {
    // GIVEN a reader on the seventh page of a list that once had that many
    const { result, rerender } = renderHook(
      ({ pageCount }) => usePagination({ listIdentity: "unfiltered", pageCount }),
      { initialProps: { pageCount: UNBOUNDED } }
    );
    act(() => result.current.setPage(7));

    // WHEN a later response reveals the list only really has six pages — the total dropped for
    // some reason that had nothing to do with a search, filter, or sort the reader chose
    rerender({ pageCount: 6 });

    // THEN they land on the last page that actually exists, instead of one request after another
    // for a page that keeps coming back empty
    expect(result.current.page).toBe(6);
  });

  it("should never clamp below the first page, even for an empty list", () => {
    // GIVEN a reader on the first page of a list that turns out to have no pages at all
    const { result, rerender } = renderHook(
      ({ pageCount }) => usePagination({ listIdentity: "unfiltered", pageCount }),
      { initialProps: { pageCount: UNBOUNDED } }
    );

    // WHEN the response reports zero pages
    rerender({ pageCount: 0 });

    // THEN the page stays at 1 rather than at 0, which nothing could ever request
    expect(result.current.page).toBe(1);
  });

  it("should leave an in-range page untouched when the total shrinks but not past it", () => {
    // GIVEN a reader on the third page
    const { result, rerender } = renderHook(
      ({ pageCount }) => usePagination({ listIdentity: "unfiltered", pageCount }),
      { initialProps: { pageCount: UNBOUNDED } }
    );
    act(() => result.current.setPage(3));

    // WHEN the total shrinks, but their page is still well within it
    rerender({ pageCount: 5 });

    // THEN they are left exactly where they were
    expect(result.current.page).toBe(3);
  });
});
