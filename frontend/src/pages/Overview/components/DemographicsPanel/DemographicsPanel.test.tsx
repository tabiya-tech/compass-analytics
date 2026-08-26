import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { DATA_TEST_ID as HBAR_TEST_ID } from "@/components/charts/HBar";
import { DATA_TEST_ID as LEGEND_TEST_ID } from "@/components/charts/DonutChart/components/ChartLegend";
import type { DemographicChart } from "@/analytics/analytics.types";
import { DemographicsPanel, DATA_TEST_ID } from "./DemographicsPanel";

/** Every slice is a `<path class="recharts-sector">`, whatever the ring's radius or gap. */
function renderedSlices(container: HTMLElement): SVGPathElement[] {
  return [...container.querySelectorAll<SVGPathElement>(".recharts-sector")];
}

const GIVEN_CHARTS: DemographicChart[] = [
  {
    type: "pie-chart",
    name: "gender",
    items: [
      { name: "female", value: 2141 },
      { name: "male", value: 1689 },
      { name: "other", value: 288 },
    ],
  },
  {
    type: "horizontal-bar-chart",
    name: "region",
    items: [
      { name: "Lusaka", value: 419 },
      { name: "Copperbelt", value: 304 },
    ],
  },
];

describe("DemographicsPanel", () => {
  it("should title the panel and describe the profile it draws", () => {
    // GIVEN a demographic breakdown
    // WHEN the panel is rendered
    render(<DemographicsPanel charts={GIVEN_CHARTS} />);

    // THEN it is titled and described
    expect(screen.getByRole("heading", { level: 2, name: "Who you are reaching" })).toBeInTheDocument();
    expect(screen.getByText("The demographic profile of jobseekers on the platform.")).toBeInTheDocument();
  });

  it("should break the population down by each chart the backend sends", () => {
    // GIVEN gender and region charts
    // WHEN the panel is rendered
    render(<DemographicsPanel charts={GIVEN_CHARTS} />);

    // THEN each dimension gets its own labelled section
    expect(screen.getAllByTestId(DATA_TEST_ID.SECTION)).toHaveLength(2);
    expect(screen.getByText("Gender")).toBeInTheDocument();
    expect(screen.getByText("Region")).toBeInTheDocument();
  });

  it("should show gender as a share of the population, translating the known values", () => {
    // GIVEN a female/male/other gender split
    // WHEN the panel is rendered
    const { container } = render(<DemographicsPanel charts={GIVEN_CHARTS} />);

    // THEN the ring divides the population, with each group named and its share stated
    expect(renderedSlices(container)).toHaveLength(3);
    const actualLegend = within(screen.getByTestId(LEGEND_TEST_ID.CONTAINER));
    expect(actualLegend.getByText("Women")).toBeInTheDocument();
    expect(actualLegend.getByText("Men")).toBeInTheDocument();
    expect(actualLegend.getByText("Other / undisclosed")).toBeInTheDocument();
  });

  it("should give every gender slice a distinct color, not two adjacent shades of green", () => {
    // GIVEN three gender slices
    // WHEN the panel is rendered
    const { container } = render(<DemographicsPanel charts={GIVEN_CHARTS} />);

    // THEN each slice is filled with a different color from the palette
    const actualFills = renderedSlices(container).map((slice) => slice.getAttribute("fill"));
    expect(new Set(actualFills).size).toBe(3);
  });

  it("should show region as counts, keeping the raw place name from the data", () => {
    // GIVEN two regions
    // WHEN the panel is rendered
    render(<DemographicsPanel charts={GIVEN_CHARTS} />);

    // THEN the region breakdown is a list of bars, labelled by the raw data value
    const actualRegions = within(screen.getByRole("list", { name: "Region" }));
    expect(actualRegions.getAllByTestId(HBAR_TEST_ID.ROW)).toHaveLength(2);
    expect(screen.getByText("Lusaka")).toBeInTheDocument();
    expect(screen.getByText("419")).toBeInTheDocument();
  });

  it("should skip a chart the frontend doesn't recognise yet", () => {
    // GIVEN a dimension the backend added that the frontend has no label config for
    const givenCharts: DemographicChart[] = [
      ...GIVEN_CHARTS,
      { type: "pie-chart", name: "age-band", items: [{ name: "18-24", value: 10 }] },
    ];

    // WHEN the panel is rendered
    render(<DemographicsPanel charts={givenCharts} />);

    // THEN only the known dimensions render
    expect(screen.getAllByTestId(DATA_TEST_ID.SECTION)).toHaveLength(2);
  });

  it("should skip a chart named after an inherited Object property, rather than misrendering it", () => {
    // GIVEN a chart whose name collides with a property every plain object inherits
    const givenCharts: DemographicChart[] = [
      ...GIVEN_CHARTS,
      { type: "pie-chart", name: "constructor", items: [{ name: "x", value: 1 }] },
    ];

    // WHEN the panel is rendered
    render(<DemographicsPanel charts={givenCharts} />);

    // THEN it is treated the same as any other unrecognised dimension: skipped
    expect(screen.getAllByTestId(DATA_TEST_ID.SECTION)).toHaveLength(2);
  });

  it("should show a loading skeleton while the first fetch is in flight, not the empty message", () => {
    // GIVEN no charts have arrived yet, but the fetch is still loading
    render(<DemographicsPanel charts={[]} isLoading />);

    // THEN a skeleton is shown, not "no data" — loading must not read as empty
    expect(screen.getByTestId(DATA_TEST_ID.LOADING)).toBeInTheDocument();
    expect(screen.queryByText("No data to show for this selection.")).not.toBeInTheDocument();
  });

  it("should show a generic empty state when there is nothing to show", () => {
    // GIVEN no charts at all
    // WHEN the panel is rendered
    render(<DemographicsPanel charts={[]} />);

    // THEN a generic empty state is shown, not the degraded message
    expect(screen.getByText("No data to show for this selection.")).toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.DEGRADED)).not.toBeInTheDocument();
  });

  it("should show a degraded message when the upstream failed rather than data being genuinely empty", () => {
    // GIVEN no charts, flagged as degraded
    // WHEN the panel is rendered
    render(<DemographicsPanel charts={[]} degraded />);

    // THEN the degraded message is shown, distinguishing an outage from real empty data
    expect(screen.getByTestId(DATA_TEST_ID.DEGRADED)).toBeInTheDocument();
    expect(screen.getByText("We couldn't load demographic data right now.")).toBeInTheDocument();
  });

  it("should flag a partial failure even while still showing the charts that did come through", () => {
    // GIVEN one chart (e.g. the backend dropped a malformed one) but the response is flagged degraded
    render(<DemographicsPanel charts={[GIVEN_CHARTS[0]]} degraded />);

    // THEN the gender chart still renders, but a degraded notice appears alongside it —
    // a partial failure isn't the same as everything being fine
    expect(screen.getByTestId(DATA_TEST_ID.DEGRADED)).toBeInTheDocument();
    expect(screen.getByText("Some demographic data couldn't be loaded right now.")).toBeInTheDocument();
    expect(screen.getAllByTestId(DATA_TEST_ID.SECTION)).toHaveLength(1);
  });
});
