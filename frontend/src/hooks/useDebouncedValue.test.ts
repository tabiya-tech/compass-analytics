import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDebouncedValue } from "./useDebouncedValue";

const GIVEN_DELAY_MS = 250;

describe("useDebouncedValue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("should report the initial value straight away", () => {
    // GIVEN a value
    // WHEN the hook is first rendered
    const { result } = renderHook(() => useDebouncedValue("lusaka", GIVEN_DELAY_MS));

    // THEN there is nothing to wait for
    expect(result.current).toBe("lusaka");
  });

  it("should hold the new value back until the delay has passed", () => {
    // GIVEN a rendered value
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, GIVEN_DELAY_MS), {
      initialProps: { value: "lus" },
    });

    // WHEN it changes
    rerender({ value: "lusaka" });

    // THEN the reported value hasn't moved yet
    expect(result.current).toBe("lus");

    // WHEN the delay passes
    act(() => vi.advanceTimersByTime(GIVEN_DELAY_MS));

    // THEN it catches up
    expect(result.current).toBe("lusaka");
  });

  it("should report only the last value when it changes faster than the delay", () => {
    // GIVEN a rendered value
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, GIVEN_DELAY_MS), {
      initialProps: { value: "" },
    });

    // WHEN it changes several times in quick succession, as a typist would
    for (const value of ["m", "ma", "maz"]) {
      rerender({ value });
      act(() => vi.advanceTimersByTime(GIVEN_DELAY_MS / 5));
    }

    // THEN none of the intermediate values were reported
    expect(result.current).toBe("");

    // WHEN the typing stops for long enough
    act(() => vi.advanceTimersByTime(GIVEN_DELAY_MS));

    // THEN only the final value is reported
    expect(result.current).toBe("maz");
  });
});
