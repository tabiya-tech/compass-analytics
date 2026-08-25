import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { MODULE_IDS } from "@/access/AccessContext";
import { TEST_CONTAINER_WIDTH } from "@/test/setup";
import { DATA_TEST_ID as STAT_TILE_TEST_ID } from "@/components/shared/StatTile";
import { DATA_TEST_ID as FUNNEL_TEST_ID } from "@/components/charts/Funnel";
import { DATA_TEST_ID as GAUGE_BAR_TEST_ID } from "@/components/charts/GaugeBar";
import { DATA_TEST_ID as H_BAR_TEST_ID } from "@/components/charts/HBar";
import { DATA_TEST_ID as LEGEND_TEST_ID } from "@/components/charts/DonutChart/components/ChartLegend";
import type {
  BuildYourProfileMetrics,
  CareerExplorerMetrics,
  JobReadinessMetrics,
  JobsMetrics,
} from "@/pages/Modules/types";
import { ModuleBody, DATA_TEST_ID } from "./ModuleBody";

const BUILD_YOUR_PROFILE: BuildYourProfileMetrics = {
  moduleId: MODULE_IDS.BUILD_YOUR_PROFILE,
  startedPercentage: 44,
  cvsGenerated: 502,
  cvsGeneratedSharePercentage: 28,
  averageMinutesToComplete: 12,
  targetMinutes: 30,
  phases: [
    { id: "intro", reached: 1798 },
    { id: "experiences", reached: 1546 },
    { id: "skills", reached: 1150 },
    { id: "completed", reached: 502 },
  ],
  degraded: false,
};

const JOB_READINESS: JobReadinessMetrics = {
  moduleId: MODULE_IDS.JOB_READINESS,
  startedPercentage: 34,
  subModules: [
    { id: "cv-builder", name: "CV Builder", started: 1016, completed: 561 },
    { id: "interview-prep", name: "Interview Prep", started: 1415, completed: 926 },
    { id: "workplace-skills", name: "Workplace Skills", started: 1073, completed: 724 },
    { id: "digital-basics", name: "Digital Basics", started: 892, completed: 438 },
  ],
};

const CAREER_EXPLORER: CareerExplorerMetrics = {
  moduleId: MODULE_IDS.CAREER_EXPLORER,
  startedPercentage: 18,
  topSectors: [
    { id: "healthcare", label: "Healthcare", explorations: 188 },
    { id: "technology", label: "Technology", explorations: 152 },
    { id: "finance", label: "Finance", explorations: 116 },
  ],
};

const JOBS: JobsMetrics = {
  moduleId: MODULE_IDS.JOBS,
  startedPercentage: 26,
  jobsSourced: 30610,
  profilesWithMatches: 879,
  profilesWithMatchesSharePercentage: 21,
  jobsViewedPerUser: 8.4,
  topCategories: [
    { id: "retail-sales", label: "Retail & sales", matches: 252 },
    { id: "hospitality", label: "Hospitality", matches: 216 },
  ],
};

/** A course's bar is its completions stacked inside its starts, so its full length is both rectangles. */
function barWidthOf(subModuleId: string): number {
  const row = screen.getAllByTestId(DATA_TEST_ID.SUB_MODULE).find((item) => item.dataset.subModule === subModuleId)!;
  return [...row.querySelectorAll("path.recharts-rectangle")].reduce(
    (total, rectangle) => total + Number(rectangle.getAttribute("width")),
    0
  );
}

function tileNamed(label: string): HTMLElement {
  return screen.getAllByTestId(STAT_TILE_TEST_ID.CONTAINER).find((tile) => within(tile).queryByText(label) !== null)!;
}

describe("ModuleBody for Build Your Profile", () => {
  it("should report how many CVs came out of the module, and of how many who started", () => {
    // GIVEN 502 CVs generated, by 28% of those who started
    // WHEN the body is rendered
    render(<ModuleBody metrics={BUILD_YOUR_PROFILE} />);

    // THEN the tile carries the count and what share of starters it represents
    const actualTile = within(tileNamed("CVs generated"));
    expect(actualTile.getByTestId(STAT_TILE_TEST_ID.VALUE)).toHaveTextContent("502");
    expect(actualTile.getByTestId(STAT_TILE_TEST_ID.CAPTION)).toHaveTextContent("28% of those who started");
  });

  it("should report how long the conversation takes, against the target it is held to", () => {
    // GIVEN a 12-minute average against a 30-minute target
    // WHEN the body is rendered
    render(<ModuleBody metrics={BUILD_YOUR_PROFILE} />);

    // THEN the tile carries both figures
    const actualTile = within(tileNamed("Avg time to complete"));
    expect(actualTile.getByTestId(STAT_TILE_TEST_ID.VALUE)).toHaveTextContent("12.0m");
    expect(actualTile.getByTestId(STAT_TILE_TEST_ID.CAPTION)).toHaveTextContent("target 30m");
  });

  it("should plot how far people get through the conversation, phase by phase", () => {
    // GIVEN a conversation entered by 1,798 people and completed by 502
    // WHEN the body is rendered
    render(<ModuleBody metrics={BUILD_YOUR_PROFILE} />);

    // THEN every phase is plotted, in the order they are reached and named in the reader's language
    const actualStages = screen.getAllByTestId(FUNNEL_TEST_ID.STAGE);
    expect(actualStages.map((stage) => stage.dataset.stage)).toEqual(["intro", "experiences", "skills", "completed"]);
    expect(actualStages[1]).toHaveTextContent("Experiences");
    // AND the panel says what the funnel measures, and against what
    expect(screen.getByRole("heading", { level: 2, name: "Conversation funnel" })).toBeInTheDocument();
    expect(screen.getByTestId(FUNNEL_TEST_ID.CAPTION)).toHaveTextContent("Reached stage · % of those who started");
  });

  it("should say there is nothing to plot when nobody entered the conversation", () => {
    // GIVEN a selection in which nobody started the conversation
    // WHEN the body is rendered
    render(<ModuleBody metrics={{ ...BUILD_YOUR_PROFILE, cvsGenerated: 0, phases: [] }} />);

    // THEN the funnel says so, and the tiles still report their zeroes
    expect(screen.getByTestId(FUNNEL_TEST_ID.EMPTY)).toHaveTextContent("No data to show for this selection.");
    expect(within(tileNamed("CVs generated")).getByTestId(STAT_TILE_TEST_ID.VALUE)).toHaveTextContent("0");
  });

  it("should say the figures are unavailable rather than show zeroes when the upstream call failed", () => {
    // GIVEN a degraded response — the upstream call failed, so these zeroes aren't real counts
    // WHEN the body is rendered
    render(<ModuleBody metrics={{ ...BUILD_YOUR_PROFILE, cvsGenerated: 0, phases: [], degraded: true }} />);

    // THEN the screen says the data is unavailable, not that nobody used the module
    expect(screen.getByRole("status")).toHaveTextContent(
      "Build Your Profile figures aren't available right now — the upstream data source didn't respond."
    );
    // AND no zeroed tile or funnel is shown in its place — that would misread as real, bad news
    expect(screen.queryByText("CVs generated")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Conversation funnel" })).not.toBeInTheDocument();
  });

  it("should show a loading skeleton, not the unavailable message or fabricated zeroes, while the very first fetch is still pending", () => {
    // GIVEN a degraded (no-real-data-yet) response that's still loading — this is what the very
    // first fetch looks like before it settles, not yet a confirmed failure
    render(<ModuleBody metrics={{ ...BUILD_YOUR_PROFILE, cvsGenerated: 0, phases: [], degraded: true }} isLoading />);

    // THEN a skeleton shows, not the "unavailable" message (that's only for a settled failure)
    expect(screen.getByTestId(DATA_TEST_ID.LOADING)).toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.DEGRADED)).not.toBeInTheDocument();
    expect(screen.queryByText("CVs generated")).not.toBeInTheDocument();
  });
});

describe("ModuleBody for Job Readiness", () => {
  it("should report one bar per course, saying how many finished it out of how many started", () => {
    // GIVEN four job-readiness courses, 561 of 1,016 CV Builder starters finishing
    // WHEN the body is rendered
    render(<ModuleBody metrics={JOB_READINESS} />);

    // THEN each course has its own bar, in the deployment's order
    const actualCourses = screen.getAllByTestId(DATA_TEST_ID.SUB_MODULE);
    expect(actualCourses.map((course) => course.dataset.subModule)).toEqual([
      "cv-builder",
      "interview-prep",
      "workplace-skills",
      "digital-basics",
    ]);
    // AND it carries both figures
    const actualBar = within(actualCourses[0]);
    expect(actualBar.getByText("CV Builder")).toBeInTheDocument();
    expect(actualBar.getByTestId(GAUGE_BAR_TEST_ID.CAPTION)).toHaveTextContent("561 completed · 1,016 started");
  });

  it("should draw every course against the busiest one, so their bars can be compared", () => {
    // GIVEN Interview Prep is the busiest course, with 1,415 of the starts
    // WHEN the body is rendered
    render(<ModuleBody metrics={JOB_READINESS} />);

    // THEN the busiest course's bar spans the whole track
    const actualBusiest = barWidthOf("interview-prep");
    expect(actualBusiest).toBeCloseTo(TEST_CONTAINER_WIDTH, 0);
    // AND every other course is drawn as its share of that same scale
    expect(barWidthOf("cv-builder") / actualBusiest).toBeCloseTo(1016 / 1415, 2);
    expect(barWidthOf("digital-basics") / actualBusiest).toBeCloseTo(892 / 1415, 2);
  });

  it("should say which shade means finished and which means started", () => {
    // GIVEN bars stacking completions inside starts
    // WHEN the body is rendered
    render(<ModuleBody metrics={JOB_READINESS} />);

    // THEN a legend names both stages
    const actualLegend = within(screen.getByTestId(LEGEND_TEST_ID.CONTAINER));
    expect(actualLegend.getByText("Completed")).toBeInTheDocument();
    expect(actualLegend.getByText("Started")).toBeInTheDocument();
  });

  it("should say so when the deployment has no job-readiness courses configured", () => {
    // GIVEN a deployment with no courses set up yet
    // WHEN the body is rendered
    render(<ModuleBody metrics={{ ...JOB_READINESS, subModules: [] }} />);

    // THEN it says so, and offers no legend for bars that aren't there
    expect(screen.getByText("This deployment has no job-readiness sub-modules yet.")).toBeInTheDocument();
    expect(screen.queryByTestId(LEGEND_TEST_ID.CONTAINER)).not.toBeInTheDocument();
  });
});

describe("ModuleBody for Career Explorer", () => {
  it("should rank the sectors people explored, keeping the order the figures came in", () => {
    // GIVEN Healthcare explored most and Finance least
    // WHEN the body is rendered
    render(<ModuleBody metrics={CAREER_EXPLORER} />);

    // THEN every sector is listed, most explored first, under a titled panel
    const actualRows = screen.getAllByTestId(H_BAR_TEST_ID.ROW);
    expect(actualRows).toHaveLength(3);
    expect(actualRows[0]).toHaveTextContent("Healthcare");
    expect(actualRows[0]).toHaveTextContent("188");
    expect(screen.getByRole("heading", { level: 2, name: "Top sectors & careers explored" })).toBeInTheDocument();
  });

  it("should say there is nothing to show when nobody explored a sector", () => {
    // GIVEN a selection in which nobody explored anything
    // WHEN the body is rendered
    render(<ModuleBody metrics={{ ...CAREER_EXPLORER, topSectors: [] }} />);

    // THEN it says so rather than drawing an empty ranking
    expect(screen.getByTestId(DATA_TEST_ID.PANEL)).toHaveTextContent("No data to show for this selection.");
  });
});

describe("ModuleBody for Jobs", () => {
  it("should report what the classifier surfaced, who it matched, and what visitors looked at", () => {
    // GIVEN 30,610 jobs in the feed, 879 matched profiles and 8.4 jobs viewed per visitor
    // WHEN the body is rendered
    render(<ModuleBody metrics={JOBS} />);

    // THEN each figure is on its own tile, thousands-separated and captioned
    expect(within(tileNamed("Jobs sourced")).getByTestId(STAT_TILE_TEST_ID.VALUE)).toHaveTextContent("30,610");
    const actualMatched = within(tileNamed("Profiles with matches"));
    expect(actualMatched.getByTestId(STAT_TILE_TEST_ID.VALUE)).toHaveTextContent("879");
    expect(actualMatched.getByTestId(STAT_TILE_TEST_ID.CAPTION)).toHaveTextContent("21% of users");
    // AND an average keeps its decimal rather than rounding to a whole job
    expect(within(tileNamed("Jobs viewed per user")).getByTestId(STAT_TILE_TEST_ID.VALUE)).toHaveTextContent("8.4");
  });

  it("should still report its tiles when no matches have landed anywhere yet", () => {
    // GIVEN a feed nobody has been matched against yet
    // WHEN the body is rendered
    render(<ModuleBody metrics={{ ...JOBS, profilesWithMatches: 0 }} />);

    // THEN the feed's own figure still stands even with no matches
    expect(within(tileNamed("Jobs sourced")).getByTestId(STAT_TILE_TEST_ID.VALUE)).toHaveTextContent("30,610");
  });
});

describe("ModuleBody", () => {
  it("should pick the body that fits the module, and say which module it is measuring", () => {
    // GIVEN Career Explorer's figures
    // WHEN the body is picked for them
    render(<ModuleBody metrics={CAREER_EXPLORER} />);

    // THEN the module's own body is what renders
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveAttribute("data-module", "career-explorer");
    expect(screen.getByRole("heading", { level: 2, name: "Top sectors & careers explored" })).toBeInTheDocument();
  });
});
