import { describe, expect, it } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import { GaugeBar, DATA_TEST_ID } from "./GaugeBar";

const LABEL = "CV Builder";

function segmentWidths(): { done: number; active: number } {
  return {
    done: Number.parseFloat(screen.getByTestId(DATA_TEST_ID.DONE).style.width),
    active: Number.parseFloat(screen.getByTestId(DATA_TEST_ID.ACTIVE).style.width),
  };
}

describe("GaugeBar", () => {
  it("should write both figures out beside the bar, since the bar itself is decorative", () => {
    // GIVEN a module with a completed and a started count
    // WHEN it is rendered
    render(
      <GaugeBar
        label={LABEL}
        value={561}
        secondaryValue={1016}
        max={2000}
        valueLabel="completed"
        secondaryValueLabel="started"
      />
    );

    // THEN the row reads as text, and the track adds nothing for a screen reader
    expect(screen.getByText(LABEL)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.CAPTION)).toHaveTextContent("561 completed · 1,016 started");
    expect(screen.getByTestId(DATA_TEST_ID.TRACK)).toHaveAttribute("aria-hidden", "true");
  });

  it("should size both segments against the shared scale, not against each other", () => {
    // GIVEN a row on a scale of 2,000 shared with its neighbours
    // WHEN it is rendered
    render(<GaugeBar label={LABEL} value={561} secondaryValue={1016} max={2000} />);

    // THEN each segment is its own share of that scale, so rows stay comparable
    const actual = segmentWidths();
    expect(actual.done).toBeCloseTo(28.05, 1);
    expect(actual.active).toBeCloseTo(50.8, 1);
  });

  it("should nest the completed segment inside the started one", () => {
    // GIVEN more started than completed
    // WHEN it is rendered
    render(<GaugeBar label={LABEL} value={561} secondaryValue={1016} max={2000} />);

    // THEN the outer segment always reaches further, so the inner reads as part
    // of it rather than as a competing bar
    const actual = segmentWidths();
    expect(actual.active).toBeGreaterThan(actual.done);
  });

  it("should fall back to the outer figure as the scale when none is shared", () => {
    // GIVEN a lone row with no shared maximum
    // WHEN it is rendered
    render(<GaugeBar label={LABEL} value={500} secondaryValue={1000} />);

    // THEN the started figure fills the track and completed takes its half
    const actual = segmentWidths();
    expect(actual.active).toBe(100);
    expect(actual.done).toBe(50);
  });

  it("should draw a single segment when there is no outer figure", () => {
    // GIVEN a measure with only a completed count
    // WHEN it is rendered
    render(<GaugeBar label={LABEL} value={750} max={1000} valueLabel="completed" />);

    // THEN both segments land on the same width, so only one is visible
    const actual = segmentWidths();
    expect(actual.done).toBe(75);
    expect(actual.active).toBe(75);
    expect(screen.getByTestId(DATA_TEST_ID.CAPTION)).toHaveTextContent("750 completed");
  });

  it("should clamp a segment that overruns the scale", () => {
    // GIVEN a row whose figures exceed the shared maximum
    // WHEN it is rendered
    render(<GaugeBar label={LABEL} value={1500} secondaryValue={3000} max={1000} />);

    // THEN neither segment runs past the end of the track
    const actual = segmentWidths();
    expect(actual.done).toBe(100);
    expect(actual.active).toBe(100);
  });

  it("should draw nothing on the track when nothing has happened yet", () => {
    // GIVEN a module nobody has started
    // WHEN it is rendered
    render(<GaugeBar label={LABEL} value={0} secondaryValue={0} max={1000} />);

    // THEN the track is empty rather than showing a hairline of progress
    const actual = segmentWidths();
    expect(actual.done).toBe(0);
    expect(actual.active).toBe(0);
  });

  it("should treat an outer figure below the completed one as no smaller than it", () => {
    // GIVEN inconsistent data, where fewer started than completed
    // WHEN it is rendered
    render(<GaugeBar label={LABEL} value={800} secondaryValue={500} max={1000} />);

    // THEN the outer segment never renders shorter than the inner, which would
    // read as a completed count spilling out of its own total
    const actual = segmentWidths();
    expect(actual.active).toBeGreaterThanOrEqual(actual.done);
  });

  it("should format both figures the way the caller asks", () => {
    // GIVEN a formatter for the unit the values are in
    const minutes = (value: number) => `${value}m`;

    // WHEN the row is rendered with it
    render(
      <GaugeBar
        label={LABEL}
        value={12}
        secondaryValue={15}
        valueFormatter={minutes}
        valueLabel="spent"
        secondaryValueLabel="budget"
      />
    );

    // THEN the caption carries the unit on both figures
    expect(screen.getByTestId(DATA_TEST_ID.CAPTION)).toHaveTextContent("12m spent · 15m budget");
  });
});
