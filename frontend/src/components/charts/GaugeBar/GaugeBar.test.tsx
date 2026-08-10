import { describe, expect, it } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import { GaugeBar, DATA_TEST_ID } from "./GaugeBar";

const LABEL = "CV Builder";

/** Every bar segment is a `<path class="recharts-rectangle">`; Recharts skips rendering one entirely for a zero value. */
function renderedBars(container: HTMLElement): SVGPathElement[] {
  return [...container.querySelectorAll<SVGPathElement>(".recharts-rectangle")];
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

  it("should draw a single segment when there is no outer figure", () => {
    // GIVEN a measure with only a completed count
    // WHEN it is rendered
    const { container } = render(<GaugeBar label={LABEL} value={750} max={1000} valueLabel="completed" />);

    // THEN there is nothing to show beyond the value itself, so only one segment is drawn
    expect(renderedBars(container)).toHaveLength(1);
    expect(screen.getByTestId(DATA_TEST_ID.CAPTION)).toHaveTextContent("750 completed");
  });

  it("should draw a second segment out to whichever figure reaches further, both in progress colours", () => {
    // GIVEN a started count beyond the completed one
    // WHEN it is rendered
    const { container } = render(<GaugeBar label={LABEL} value={561} secondaryValue={1016} max={2000} />);

    // THEN a second figure is a further stage of the same progress, not a
    // target to fail against — both segments read as shades of green, even
    // though `value` alone would fall short of `max`
    const bars = renderedBars(container);
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAttribute("fill", "var(--chart-progress-done)");
    expect(bars[1]).toHaveAttribute("fill", "var(--chart-progress-active)");
  });

  it("should treat an outer figure below the value as no smaller than it", () => {
    // GIVEN inconsistent data, where fewer started than completed
    // WHEN it is rendered
    const { container } = render(<GaugeBar label={LABEL} value={800} secondaryValue={500} max={1000} />);

    // THEN there is nothing left over to draw as a remainder
    expect(renderedBars(container)).toHaveLength(1);
  });

  it("should draw nothing on the track when nothing has happened yet", () => {
    // GIVEN a module nobody has started
    // WHEN it is rendered
    const { container } = render(<GaugeBar label={LABEL} value={0} secondaryValue={0} max={1000} />);

    // THEN no bar segment is drawn, but the track itself (its own muted background) still is
    expect(renderedBars(container)).toHaveLength(0);
    expect(screen.getByTestId(DATA_TEST_ID.TRACK)).toBeInTheDocument();
  });

  it("should still draw the started segment when nothing is complete yet", () => {
    // GIVEN some progress on the outer figure but none on the value itself
    // WHEN it is rendered
    const { container } = render(<GaugeBar label={LABEL} value={0} secondaryValue={120} max={200} />);

    // THEN the remainder segment is drawn on its own, starting from the beginning of the track
    const bars = renderedBars(container);
    expect(bars).toHaveLength(1);
    expect(bars[0]).toHaveAttribute("fill", "var(--chart-progress-active)");
  });

  it("should clamp a segment that overruns the scale instead of overflowing the track", () => {
    // GIVEN figures that exceed the shared maximum
    // WHEN it is rendered
    const { container } = render(<GaugeBar label={LABEL} value={1500} secondaryValue={3000} max={1000} />);

    // THEN only the value segment is visible, filling the whole track, and the excess remainder is clipped away
    const bars = renderedBars(container);
    expect(bars).toHaveLength(1);
    expect(Number(bars[0].getAttribute("width"))).toBeCloseTo(600, 0);
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

  describe("pass/fail colouring against an explicit target", () => {
    it("should colour the value segment as on-track when it meets the target", () => {
      // GIVEN a value that has reached its target
      // WHEN it is rendered
      const { container } = render(<GaugeBar label={LABEL} value={1000} max={1000} />);

      // THEN the segment is drawn in the brand colour used elsewhere for a healthy series
      const bars = renderedBars(container);
      expect(bars[0]).toHaveAttribute("fill", "var(--chart-1)");
    });

    it("should colour the value segment as on-track when it exceeds the target", () => {
      // GIVEN a value beyond its target
      // WHEN it is rendered
      const { container } = render(<GaugeBar label={LABEL} value={1200} max={1000} />);

      // THEN it still reads as on-track
      const bars = renderedBars(container);
      expect(bars[0]).toHaveAttribute("fill", "var(--chart-1)");
    });

    it("should colour the value segment as off-track when it falls short of the target", () => {
      // GIVEN a value that has not reached its target
      // WHEN it is rendered
      const { container } = render(<GaugeBar label={LABEL} value={400} max={1000} />);

      // THEN it is coloured with the shared "off track" warning colour, not a data-series colour
      const bars = renderedBars(container);
      expect(bars[0]).toHaveAttribute("fill", "var(--chart-warning)");
    });

    it("should always read as on-track when no target is given to fail against", () => {
      // GIVEN a lone figure with no explicit max, auto-scaled to itself
      // WHEN it is rendered
      const { container } = render(<GaugeBar label={LABEL} value={30} />);

      // THEN there is nothing to fail against, so it is coloured on-track
      const bars = renderedBars(container);
      expect(bars[0]).toHaveAttribute("fill", "var(--chart-1)");
    });
  });
});
