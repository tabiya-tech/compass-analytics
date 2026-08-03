import { describe, expect, it } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import { StatTile, DATA_TEST_ID } from "./StatTile";

describe("StatTile", () => {
  it("should render the label and value of a metric with nothing else", () => {
    // GIVEN a metric with no trend and no sparkline
    // WHEN rendered
    render(<StatTile label="Cumulative users" value="4,118" />);

    // THEN the label and value show, and neither optional slot is filled
    expect(screen.getByText("Cumulative users")).toBeInTheDocument();
    expect(screen.getByText("4,118")).toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.TREND)).not.toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.SPARKLINE)).not.toBeInTheDocument();
  });

  it("should describe a rise as an upward trend", () => {
    // GIVEN a metric that grew by 12% since the last quarter
    // WHEN rendered
    render(<StatTile label="Active users" value="1,705" trend={{ value: 12, label: "vs. last quarter" }} />);

    // THEN the delta reads as a rise, with its qualifier
    expect(screen.getByTestId(DATA_TEST_ID.TREND)).toHaveAttribute("data-direction", "up");
    expect(screen.getByText("Up 12%")).toBeInTheDocument();
    expect(screen.getByText("vs. last quarter")).toBeInTheDocument();
  });

  it("should describe a fall as a downward trend, showing the magnitude without its sign", () => {
    // GIVEN a metric that fell by 60%
    // WHEN rendered
    render(<StatTile label="Cumulative users" value="4,118" trend={{ value: -60 }} />);

    // THEN the delta reads as a fall, and the visible figure drops the minus sign
    expect(screen.getByTestId(DATA_TEST_ID.TREND)).toHaveAttribute("data-direction", "down");
    expect(screen.getByText("Down 60%")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("should describe a delta of zero as no change rather than a rise", () => {
    // GIVEN a metric that didn't move
    // WHEN rendered
    render(<StatTile label="Avg session length" value="9m" trend={{ value: 0 }} />);

    // THEN it reads as no change
    expect(screen.getByTestId(DATA_TEST_ID.TREND)).toHaveAttribute("data-direction", "flat");
    expect(screen.getByText("No change")).toBeInTheDocument();
  });

  it("should render whatever is passed into the sparkline slot, alongside the value rather than the trend", () => {
    // GIVEN a metric with a chart in its sparkline slot, and a trend underneath it
    render(<StatTile label="Cumulative users" value="4,118" trend={{ value: -60 }} sparkline={<span>chart</span>} />);

    // THEN the chart shows inside the slot
    const sparkline = screen.getByText("chart");
    expect(sparkline).toBeInTheDocument();

    // AND it shares a row with the value, not with the trend below it
    const valueRow = screen.getByTestId(DATA_TEST_ID.VALUE).parentElement;
    expect(valueRow).toContainElement(sparkline);
    expect(valueRow).not.toContainElement(screen.getByTestId(DATA_TEST_ID.TREND));
  });

  it("should render the caption under the value", () => {
    // GIVEN a metric qualified by a caption rather than a delta
    // WHEN rendered
    render(<StatTile label="Active users" value="1,705" caption="41% of users · last 30 days" />);

    // THEN the caption shows
    expect(screen.getByText("41% of users · last 30 days")).toBeInTheDocument();
  });

  it("should render the icon passed into the icon slot as decoration", () => {
    // GIVEN a metric with an icon
    // WHEN rendered
    render(<StatTile label="Active users" value="1,705" icon={<svg data-testid="icon" />} />);

    // THEN the icon fills the slot and stays out of the accessibility tree
    const slot = screen.getByTestId(DATA_TEST_ID.ICON);
    expect(slot).toHaveAttribute("aria-hidden", "true");
    expect(slot.querySelector("svg")).toHaveAttribute("data-testid", "icon");
  });
});
