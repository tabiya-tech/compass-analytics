import { describe, expect, it } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import { Sparkline, DATA_TEST_ID } from "./Sparkline";

const RISING = [180, 240, 320, 590];
const FALLING = [610, 400, 260, 170];
const FLAT = [200, 260, 200];

describe("Sparkline", () => {
  it("should describe a rising trend by its first and last value", () => {
    // GIVEN a series that ends higher than it started
    // WHEN it is rendered without a label of its own
    render(<Sparkline values={RISING} />);

    // THEN the generated name states the direction and both ends, since a bare
    // SVG has no accessible name at all
    expect(screen.getByRole("img", { name: "Trend rising, from 180 to 590" })).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveAttribute("data-direction", "up");
  });

  it("should describe a falling trend", () => {
    // GIVEN a series that ends lower than it started
    // WHEN it is rendered
    render(<Sparkline values={FALLING} />);

    // THEN the name says so
    expect(screen.getByRole("img", { name: "Trend falling, from 610 to 170" })).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveAttribute("data-direction", "down");
  });

  it("should describe a flat trend by its single value", () => {
    // GIVEN a series that ends where it started
    // WHEN it is rendered
    render(<Sparkline values={FLAT} />);

    // THEN the name reports no movement rather than a direction
    expect(screen.getByRole("img", { name: "Trend flat at 200" })).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveAttribute("data-direction", "flat");
  });

  it("should prefer an explicit label over the generated summary", () => {
    // GIVEN a caller that knows what the trend means
    const label = "Active users over the last twelve months";

    // WHEN the sparkline is given that label
    render(<Sparkline values={RISING} label={label} />);

    // THEN it is used as-is
    expect(screen.getByRole("img", { name: label })).toBeInTheDocument();
  });

  it("should render nothing when there is no shape to draw", () => {
    // GIVEN fewer than two points
    // WHEN a sparkline is rendered from them
    const { unmount } = render(<Sparkline values={[42]} />);

    // THEN nothing is drawn, rather than a dot claiming to be a trend
    expect(screen.queryByTestId(DATA_TEST_ID.CONTAINER)).not.toBeInTheDocument();
    unmount();

    // AND the same for no points at all
    render(<Sparkline values={[]} />);
    expect(screen.queryByTestId(DATA_TEST_ID.CONTAINER)).not.toBeInTheDocument();
  });

  it("should draw the area and the end marker only when asked", () => {
    // GIVEN a plain sparkline
    const { unmount } = render(<Sparkline values={RISING} />);

    // THEN it is just the line
    expect(screen.getByTestId(DATA_TEST_ID.LINE)).toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.AREA)).not.toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.END_MARKER)).not.toBeInTheDocument();
    unmount();

    // WHEN the fill and the end marker are turned on
    render(<Sparkline values={RISING} filled showEndMarker />);

    // THEN the latest value is called out and the area washed in
    expect(screen.getByTestId(DATA_TEST_ID.AREA)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.END_MARKER)).toBeInTheDocument();
  });

  it("should format the values in its generated name the way the caller asks", () => {
    // GIVEN a formatter for the unit the values are in
    const formatter = (value: number) => `${value}m`;

    // WHEN the sparkline is rendered with it
    render(<Sparkline values={[12, 18]} valueFormatter={formatter} />);

    // THEN the generated name carries the unit too
    expect(screen.getByRole("img", { name: "Trend rising, from 12m to 18m" })).toBeInTheDocument();
  });
});
