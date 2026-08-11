import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { DATA_TEST_ID as DONUT_TEST_ID } from "@/components/charts/DonutChart";
import { DATA_TEST_ID as HBAR_TEST_ID } from "@/components/charts/HBar";
import { DATA_TEST_ID as LEGEND_TEST_ID } from "@/components/charts/DonutChart/components/ChartLegend";
import type { Demographics } from "@/pages/Overview/overview.types";
import { DemographicsPanel, DATA_TEST_ID } from "./DemographicsPanel";

/** Every slice is a `<path class="recharts-sector">`, whatever the ring's radius or gap. */
function renderedSlices(container: HTMLElement): SVGPathElement[] {
  return [...container.querySelectorAll<SVGPathElement>(".recharts-sector")];
}

const GIVEN_DEMOGRAPHICS: Demographics = {
  gender: [
    { id: "women", users: 2141 },
    { id: "men", users: 1689 },
    { id: "undisclosed", users: 288 },
  ],
  ageBands: [
    { id: "18-24", users: 993 },
    { id: "25-34", users: 780 },
    { id: "35-44", users: 378 },
    { id: "45-plus", users: 213 },
  ],
  educationLevels: [
    { id: "primary", users: 331 },
    { id: "secondary", users: 1135 },
    { id: "tertiary", users: 898 },
  ],
  regions: [
    { id: "lusaka", label: "Lusaka", users: 419 },
    { id: "copperbelt", label: "Copperbelt", users: 304 },
  ],
};

describe("DemographicsPanel", () => {
  it("should title the panel and describe the profile it draws", () => {
    // GIVEN a full demographic breakdown
    // WHEN the panel is rendered
    render(<DemographicsPanel demographics={GIVEN_DEMOGRAPHICS} />);

    // THEN it is titled and described
    expect(screen.getByRole("heading", { level: 2, name: "Who you are reaching" })).toBeInTheDocument();
    expect(screen.getByText("The demographic profile of jobseekers on the platform.")).toBeInTheDocument();
  });

  it("should break the population down by gender, age, education and region", () => {
    // GIVEN a full demographic breakdown
    // WHEN the panel is rendered
    render(<DemographicsPanel demographics={GIVEN_DEMOGRAPHICS} />);

    // THEN each dimension gets its own labelled section
    expect(screen.getAllByTestId(DATA_TEST_ID.SECTION)).toHaveLength(4);
    expect(screen.getByText("Gender")).toBeInTheDocument();
    expect(screen.getByText("Age band")).toBeInTheDocument();
    expect(screen.getByText("Education")).toBeInTheDocument();
    expect(screen.getByText("Region")).toBeInTheDocument();
  });

  it("should show gender as a share of the population", () => {
    // GIVEN a roughly even gender split
    // WHEN the panel is rendered
    const { container } = render(<DemographicsPanel demographics={GIVEN_DEMOGRAPHICS} />);

    // THEN the ring divides the population, with each group named and its share stated
    expect(renderedSlices(container)).toHaveLength(3);
    const actualLegend = within(screen.getByTestId(LEGEND_TEST_ID.CONTAINER));
    expect(actualLegend.getByText("Women")).toBeInTheDocument();
    expect(actualLegend.getByText("52%")).toBeInTheDocument();
    expect(actualLegend.getByText("Other / undisclosed")).toBeInTheDocument();
  });

  it("should show age, education and region as counts, each against its own scale", () => {
    // GIVEN four age bands, three education levels and two regions
    // WHEN the panel is rendered
    render(<DemographicsPanel demographics={GIVEN_DEMOGRAPHICS} />);

    // THEN each breakdown is its own list of bars
    const actualAgeBands = within(screen.getByRole("list", { name: "Age band" }));
    const actualEducation = within(screen.getByRole("list", { name: "Education" }));
    const actualRegions = within(screen.getByRole("list", { name: "Region" }));
    expect(actualAgeBands.getAllByTestId(HBAR_TEST_ID.ROW)).toHaveLength(4);
    expect(actualEducation.getAllByTestId(HBAR_TEST_ID.ROW)).toHaveLength(3);
    expect(actualRegions.getAllByTestId(HBAR_TEST_ID.ROW)).toHaveLength(2);
  });

  it("should label the age bands as ranges and the regions by name, with their counts", () => {
    // GIVEN the youngest band holding 993 jobseekers and Lusaka holding 419
    // WHEN the panel is rendered
    render(<DemographicsPanel demographics={GIVEN_DEMOGRAPHICS} />);

    // THEN the band reads as a range, and the region keeps the name from the data
    expect(screen.getByText("18–24")).toBeInTheDocument();
    expect(screen.getByText("993")).toBeInTheDocument();
    expect(screen.getByText("Lusaka")).toBeInTheDocument();
    expect(screen.getByText("419")).toBeInTheDocument();
  });

  it("should show an empty state per breakdown when a dimension has no data", () => {
    // GIVEN a population with no demographic data recorded at all
    const givenNothing: Demographics = { gender: [], ageBands: [], educationLevels: [], regions: [] };

    // WHEN the panel is rendered
    render(<DemographicsPanel demographics={givenNothing} />);

    // THEN the sections still stand, each saying it has nothing to show
    expect(screen.getAllByTestId(DATA_TEST_ID.SECTION)).toHaveLength(4);
    expect(screen.getByTestId(DONUT_TEST_ID.EMPTY)).toBeInTheDocument();
    expect(screen.getAllByTestId(HBAR_TEST_ID.EMPTY)).toHaveLength(3);
  });
});
