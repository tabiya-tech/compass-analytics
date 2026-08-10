import { describe, expect, it } from "vitest";
import { formatNumber, percentageOf } from "./chart-scale";

describe("formatNumber", () => {
  it("should separate thousands for values read in full", () => {
    // GIVEN a value shown in a tooltip or a data table
    // WHEN it is formatted
    // THEN it is grouped and rounded to at most one decimal
    expect(formatNumber(1284)).toBe("1,284");
    expect(formatNumber(12.34)).toBe("12.3");
  });
});

describe("percentageOf", () => {
  it("should give a slice's whole-percentage share", () => {
    // GIVEN a slice and the whole it belongs to
    // WHEN its share is taken
    // THEN it is rounded to a whole percentage
    expect(percentageOf(60, 100)).toBe(60);
    expect(percentageOf(1, 3)).toBe(33);
  });

  it("should report nothing rather than dividing by an empty whole", () => {
    // GIVEN a whole with no value in it
    // WHEN a share is taken
    // THEN it is zero, not infinite
    expect(percentageOf(5, 0)).toBe(0);
  });
});
