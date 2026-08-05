import { describe, expect, it } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import { CompletionRing, DATA_TEST_ID } from "./CompletionRing";

// How much of the ring is left undrawn — 0 when complete, the full circumference when empty.
function dashOffsetOf(): number {
  const progress = screen.getByTestId(DATA_TEST_ID.PROGRESS);
  return Number(progress.getAttribute("stroke-dashoffset"));
}

const CIRCUMFERENCE = 2 * Math.PI * 42;

describe("CompletionRing", () => {
  it("should draw none of the ring at 0%", () => {
    // GIVEN no progress at all
    // WHEN rendered
    render(<CompletionRing value={0} />);

    // THEN the progress arc is fully offset, and the value is exposed as a progress bar
    expect(dashOffsetOf()).toBeCloseTo(CIRCUMFERENCE);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("should draw part of the ring at a partial value", () => {
    // GIVEN 64% progress
    // WHEN rendered
    render(<CompletionRing value={64} />);

    // THEN 64% of the ring is drawn
    expect(dashOffsetOf()).toBeCloseTo(CIRCUMFERENCE * 0.36);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "64");
  });

  it("should draw the whole ring at 100%", () => {
    // GIVEN full progress
    // WHEN rendered
    render(<CompletionRing value={100} />);

    // THEN nothing is left undrawn
    expect(dashOffsetOf()).toBeCloseTo(0);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("should name the progress bar with its percentage", () => {
    // GIVEN 90% progress
    // WHEN rendered
    render(<CompletionRing value={90} />);

    // THEN the ring is reachable by a name that states the percentage
    expect(screen.getByRole("progressbar", { name: "90% complete" })).toBeInTheDocument();
  });

  it("should expose the fixed 0-100 range to assistive tech", () => {
    // GIVEN any progress value
    // WHEN rendered
    render(<CompletionRing value={64} />);

    // THEN the range bounds are always 0 to 100, regardless of the value
    const ring = screen.getByRole("progressbar");
    expect(ring).toHaveAttribute("aria-valuemin", "0");
    expect(ring).toHaveAttribute("aria-valuemax", "100");
  });

  it("should clamp values outside 0–100", () => {
    // GIVEN values below and above the range
    // WHEN rendered
    const { unmount } = render(<CompletionRing value={-20} />);

    // THEN the low one clamps to 0
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    unmount();

    // AND the high one clamps to 100
    render(<CompletionRing value={140} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("should color the arc amber below halfway, to read as needing attention", () => {
    // GIVEN a score below 50%
    // WHEN rendered
    render(<CompletionRing value={40} />);

    // THEN the arc is amber rather than green
    expect(screen.getByTestId(DATA_TEST_ID.PROGRESS)).toHaveClass("stroke-amber-400");
  });

  it("should color the arc green from halfway up to, but not including, 100%", () => {
    // GIVEN a score at the halfway boundary and one just short of complete
    const { unmount } = render(<CompletionRing value={50} />);

    // THEN the arc is green
    expect(screen.getByTestId(DATA_TEST_ID.PROGRESS)).toHaveClass("stroke-green-2");
    unmount();

    // AND still the same green just short of 100%
    render(<CompletionRing value={99} />);
    expect(screen.getByTestId(DATA_TEST_ID.PROGRESS)).toHaveClass("stroke-green-2");
  });

  it("should color the arc a deeper green once fully complete", () => {
    // GIVEN a fully complete score
    // WHEN rendered
    render(<CompletionRing value={100} />);

    // THEN the arc gets its own, more emphatic green
    expect(screen.getByTestId(DATA_TEST_ID.PROGRESS)).toHaveClass("stroke-green-3");
  });

  it("should show the centre label when one is given, and nothing when it isn't", () => {
    // GIVEN a ring with a centre label
    const { unmount } = render(<CompletionRing value={90} label="90%" />);

    // THEN the label shows in the middle
    expect(screen.getByText("90%")).toBeInTheDocument();
    unmount();

    // WHEN the same ring is rendered without a label
    render(<CompletionRing value={90} />);

    // THEN the middle stays empty
    expect(screen.queryByTestId(DATA_TEST_ID.LABEL)).not.toBeInTheDocument();
  });
});
