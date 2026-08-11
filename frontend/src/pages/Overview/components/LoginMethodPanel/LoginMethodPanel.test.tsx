import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { DATA_TEST_ID as DONUT_TEST_ID } from "@/components/charts/DonutChart";
import { DATA_TEST_ID as LEGEND_TEST_ID } from "@/components/charts/DonutChart/components/ChartLegend";
import type { LoginMethodSlice } from "@/pages/Overview/overview.types";
import { LoginMethodPanel, DATA_TEST_ID } from "./LoginMethodPanel";

const GIVEN_SPLIT: LoginMethodSlice[] = [
  { method: "google", users: 2471 },
  { method: "email", users: 1647 },
];

/** Every slice is a `<path class="recharts-sector">`, whatever the ring's radius or gap. */
function renderedSlices(container: HTMLElement): SVGPathElement[] {
  return [...container.querySelectorAll<SVGPathElement>(".recharts-sector")];
}

describe("LoginMethodPanel", () => {
  it("should title the panel and describe what the ring divides", () => {
    // GIVEN a Google/Email split
    // WHEN the panel is rendered
    render(<LoginMethodPanel loginMethods={GIVEN_SPLIT} averageLoginsPerUser={2.2} />);

    // THEN it is titled and described
    expect(screen.getByRole("heading", { level: 2, name: "How they log in" })).toBeInTheDocument();
    expect(screen.getByText("Share of users by login method")).toBeInTheDocument();
  });

  it("should draw one segment per login method, naming each with its share", () => {
    // GIVEN a 60/40 split between Google and Email
    // WHEN the panel is rendered
    const { container } = render(<LoginMethodPanel loginMethods={GIVEN_SPLIT} averageLoginsPerUser={2.2} />);

    // THEN both methods are drawn
    expect(renderedSlices(container)).toHaveLength(2);
    // AND the legend carries the translated method names with their shares
    const actualLegend = within(screen.getByTestId(LEGEND_TEST_ID.CONTAINER));
    expect(actualLegend.getByText("Google")).toBeInTheDocument();
    expect(actualLegend.getByText("60%")).toBeInTheDocument();
    expect(actualLegend.getByText("Email")).toBeInTheDocument();
    expect(actualLegend.getByText("40%")).toBeInTheDocument();
  });

  it("should put the average logins per user in the middle of the ring, and explain the figure", () => {
    // GIVEN an average of 2.2 logins per user
    // WHEN the panel is rendered
    render(<LoginMethodPanel loginMethods={GIVEN_SPLIT} averageLoginsPerUser={2.2} />);

    // THEN the figure sits in the centre
    expect(screen.getByTestId(DONUT_TEST_ID.CENTER_LABEL)).toHaveTextContent("2.2");
    // AND the footnote says what it means
    expect(screen.getByText("Center figure = avg logins / user")).toBeInTheDocument();
  });

  it("should state the average in text, since the ring's centre is hidden from assistive tech", () => {
    // GIVEN an average of 2.2 logins per user
    // WHEN the panel is rendered
    render(<LoginMethodPanel loginMethods={GIVEN_SPLIT} averageLoginsPerUser={2.2} />);

    // THEN the figure is also available as text
    expect(screen.getByTestId(DATA_TEST_ID.AVERAGE_LOGINS)).toHaveTextContent("Average logins per user: 2.2");
    expect(screen.getByTestId(DONUT_TEST_ID.CENTER_LABEL)).toHaveAttribute("aria-hidden", "true");
  });

  it("should draw a single full ring when the split is filtered to one method", () => {
    // GIVEN the population filtered to Google sign-ins only
    const givenFilteredSplit: LoginMethodSlice[] = [{ method: "google", users: 2471 }];

    // WHEN the panel is rendered
    const { container } = render(<LoginMethodPanel loginMethods={givenFilteredSplit} averageLoginsPerUser={2.4} />);

    // THEN one segment carries the whole ring
    expect(renderedSlices(container)).toHaveLength(1);
    expect(within(screen.getByTestId(LEGEND_TEST_ID.CONTAINER)).getByText("100%")).toBeInTheDocument();
  });

  it("should show a greyed-out ring with a short label when nobody has logged in over the window", () => {
    // GIVEN no logins at all
    // WHEN the panel is rendered
    render(<LoginMethodPanel loginMethods={[]} averageLoginsPerUser={0} />);

    // THEN the ring is replaced by an empty shape, labelled so it doesn't read as loading
    expect(screen.getByTestId(DONUT_TEST_ID.EMPTY)).toHaveTextContent("No data to show for this selection.");
  });
});
