import { describe, expect, it } from "vitest";
import {
  areaPath,
  axisMax,
  bandCenter,
  formatCompact,
  formatNumber,
  linePath,
  nearestIndex,
  niceTicks,
  percentageOf,
  plotFrom,
  topRoundedRectPath,
  xAt,
  yAt,
  type ChartMargin,
  type ChartPlot,
} from "./chart-scale";

const MARGIN: ChartMargin = { top: 10, right: 10, bottom: 20, left: 40 };
const PLOT: ChartPlot = { left: 40, top: 10, width: 200, height: 100 };

describe("plotFrom", () => {
  it("should take the axis gutters out of the container", () => {
    // GIVEN a container and the margins its axes need
    // WHEN the plot area is derived
    const actualPlot = plotFrom(300, 200, MARGIN);

    // THEN the plot sits inside the gutters
    expect(actualPlot).toEqual({ left: 40, top: 10, width: 250, height: 170 });
  });

  it("should collapse to an empty plot when the container is narrower than its own gutters", () => {
    // GIVEN a container too small to fit its axes
    // WHEN the plot area is derived
    const actualPlot = plotFrom(20, 10, MARGIN);

    // THEN the plot is empty rather than negative, so no mark renders inverted
    expect(actualPlot.width).toBe(0);
    expect(actualPlot.height).toBe(0);
  });
});

describe("niceTicks", () => {
  it("should land on round numbers rather than fractions of the maximum", () => {
    // GIVEN an awkward maximum
    // WHEN ticks are chosen
    const actualTicks = niceTicks(656);

    // THEN they read as round numbers that cover the data
    expect(actualTicks).toEqual([0, 200, 400, 600, 800]);
  });

  it("should step in 1s, 2s or 5s of the appropriate magnitude", () => {
    // GIVEN maxima at different magnitudes
    // WHEN ticks are chosen for each
    // THEN the step is always a 1, 2 or 5 of the right power of ten
    expect(niceTicks(4)).toEqual([0, 1, 2, 3, 4]);
    expect(niceTicks(9)).toEqual([0, 5, 10]);
    expect(niceTicks(38)).toEqual([0, 10, 20, 30, 40]);
    expect(niceTicks(9000)).toEqual([0, 5000, 10000]);
  });

  it("should keep float drift out of the labels", () => {
    // GIVEN a maximum small enough that a fractional step is needed
    // WHEN ticks are chosen
    const actualTicks = niceTicks(0.9);

    // THEN no tick carries an accumulated rounding error
    for (const tick of actualTicks) {
      expect(String(tick)).not.toMatch(/\d{6,}/);
    }
  });

  it("should fall back to a single zero tick when there is nothing to scale", () => {
    // GIVEN a maximum that can't define a scale
    // WHEN ticks are chosen
    // THEN only the baseline is offered
    expect(niceTicks(0)).toEqual([0]);
    expect(niceTicks(-10)).toEqual([0]);
    expect(niceTicks(Number.NaN)).toEqual([0]);
  });
});

describe("axisMax", () => {
  it("should raise the axis top to the first round tick above the data", () => {
    // GIVEN a data maximum between two round ticks
    // WHEN the axis top is derived
    // THEN it is the tick above, so the tallest mark never touches the ceiling
    expect(axisMax(656)).toBe(800);
    expect(axisMax(38)).toBe(40);
  });

  it("should never return zero, so a scale can always be divided by it", () => {
    // GIVEN no data
    // WHEN the axis top is derived
    // THEN it falls back to one rather than zero
    expect(axisMax(0)).toBe(1);
  });
});

describe("formatCompact", () => {
  it("should write values below ten thousand in full", () => {
    // GIVEN values that fit comfortably on a tick
    // WHEN they are compacted
    // THEN they keep their thousands separator and every digit
    expect(formatCompact(1284)).toBe("1,284");
    expect(formatCompact(9999)).toBe("9,999");
  });

  it("should abbreviate thousands and millions", () => {
    // GIVEN values large enough to crowd a tick
    // WHEN they are compacted
    // THEN they are abbreviated, and a trailing zero decimal is dropped
    expect(formatCompact(12_900)).toBe("12.9K");
    expect(formatCompact(10_000)).toBe("10K");
    expect(formatCompact(4_200_000)).toBe("4.2M");
  });

  it("should compact negative values by magnitude", () => {
    // GIVEN a large negative value
    // WHEN it is compacted
    // THEN the sign survives the abbreviation
    expect(formatCompact(-12_900)).toBe("-12.9K");
  });
});

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

describe("nearestIndex", () => {
  it("should snap to the closest data position, so the reader aims at a date", () => {
    // GIVEN a plot with five positions across 200px, starting at x=40
    const count = 5;

    // WHEN the pointer lands just past the second position
    const actualIndex = nearestIndex(95, PLOT, count);

    // THEN it snaps to that position rather than to the raw pixel
    expect(actualIndex).toBe(1);
  });

  it("should clamp to the ends when the pointer leaves the plot", () => {
    // GIVEN a pointer beyond either edge of the plot
    // WHEN the nearest position is taken
    // THEN it never escapes the data's range
    expect(nearestIndex(-500, PLOT, 5)).toBe(0);
    expect(nearestIndex(9999, PLOT, 5)).toBe(4);
  });

  it("should report the only position when there is a single one", () => {
    // GIVEN a single data position
    // WHEN the nearest is taken from anywhere
    // THEN it is that one
    expect(nearestIndex(150, PLOT, 1)).toBe(0);
  });
});

describe("bandCenter", () => {
  it("should centre each band in its own share of the plot", () => {
    // GIVEN four bands sharing a 200px plot that starts at x=40
    // WHEN each band's centre is taken
    // THEN the bands are evenly spaced, each centred in its 50px slot
    expect(bandCenter(0, 4, PLOT)).toBe(65);
    expect(bandCenter(3, 4, PLOT)).toBe(215);
  });
});

describe("xAt and yAt", () => {
  it("should spread positions from the plot's left edge to its right", () => {
    // GIVEN three positions across the plot
    // WHEN their x coordinates are taken
    // THEN the first and last sit on the plot's edges
    expect(xAt(0, 3, PLOT)).toBe(40);
    expect(xAt(2, 3, PLOT)).toBe(240);
  });

  it("should centre a lone position in the plot", () => {
    // GIVEN a single position
    // WHEN its x coordinate is taken
    // THEN it sits in the middle rather than pinned to an edge
    expect(xAt(0, 1, PLOT)).toBe(140);
  });

  it("should measure values up from the baseline", () => {
    // GIVEN a value scale topping out at 100
    const max = 100;

    // WHEN coordinates are taken across the scale
    // THEN zero sits on the baseline and the maximum at the plot's top
    expect(yAt(0, max, PLOT)).toBe(110);
    expect(yAt(50, max, PLOT)).toBe(60);
    expect(yAt(100, max, PLOT)).toBe(10);
  });

  it("should rest on the baseline when there is no scale to measure against", () => {
    // GIVEN an empty value scale
    // WHEN a coordinate is taken
    // THEN it falls on the baseline rather than dividing by zero
    expect(yAt(5, 0, PLOT)).toBe(110);
  });
});

describe("linePath and areaPath", () => {
  it("should move to the first point and draw through the rest", () => {
    // GIVEN a series of three values
    const values = [0, 50, 100];

    // WHEN a line path is built
    const actualPath = linePath(values, 100, PLOT);

    // THEN it opens with a move and continues with line segments
    expect(actualPath).toBe("M40,110 L140,60 L240,10");
  });

  it("should close the area down to the baseline", () => {
    // GIVEN the same series
    const values = [0, 50, 100];

    // WHEN an area path is built
    const actualPath = areaPath(values, 100, PLOT);

    // THEN the line is carried down to the baseline and closed
    expect(actualPath).toBe("M40,110 L140,60 L240,10 L240,110 L40,110 Z");
  });

  it("should produce nothing for a series with no values", () => {
    // GIVEN an empty series
    // WHEN paths are built
    // THEN both are empty, so nothing is drawn
    expect(linePath([], 100, PLOT)).toBe("");
    expect(areaPath([], 100, PLOT)).toBe("");
  });
});

describe("topRoundedRectPath", () => {
  it("should round only the top corners, leaving the baseline square", () => {
    // GIVEN a bar tall enough for its corner radius
    // WHEN its path is built
    const actualPath = topRoundedRectPath(10, 20, 24, 100, 4);

    // THEN the top corners curve and the bottom edge stays straight
    expect(actualPath).toContain("Q");
    expect(actualPath.startsWith("M10,120")).toBe(true);
  });

  it("should shrink the radius to fit a bar shorter than it, so the corner never overruns", () => {
    // GIVEN a bar only a pixel tall, against a 4px corner radius
    // WHEN its path is built
    const actualPath = topRoundedRectPath(10, 20, 24, 1, 4);

    // THEN the curve is clamped to the bar's own height rather than escaping it
    expect(actualPath).toContain("Q10,20 11,20");
  });

  it("should drop the curve entirely for a bar with no height", () => {
    // GIVEN a bar with nothing to draw
    // WHEN its path is built
    const actualPath = topRoundedRectPath(10, 20, 24, 0, 4);

    // THEN there is no curve command at all
    expect(actualPath).not.toContain("Q");
  });
});
