import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { DATA_TEST_ID as TABLE_TEST_ID } from "@/components/charts/components/ChartDataTable";
import { Funnel, DATA_TEST_ID, type FunnelStage } from "./Funnel";

/** The Build Your Profile conversation, as the designs draw it. */
const GIVEN_STAGES: FunnelStage[] = [
  { id: "intro", label: "Intro", value: 1798 },
  { id: "experiences", label: "Experiences", value: 1546 },
  { id: "skills", label: "Skills", value: 1150 },
  { id: "review", label: "Review", value: 718 },
  { id: "completed", label: "Completed", value: 502 },
];

function renderedBars(): HTMLElement[] {
  return screen.getAllByTestId(DATA_TEST_ID.BAR);
}

describe("Funnel", () => {
  it("should draw one bar per stage, in the order the stages are given", () => {
    // GIVEN a five-stage conversation funnel
    // WHEN the funnel is rendered
    render(<Funnel label="Conversation funnel" stages={GIVEN_STAGES} />);

    // THEN every stage is drawn, keeping the funnel's order
    const actualStages = screen.getAllByTestId(DATA_TEST_ID.STAGE);
    expect(actualStages).toHaveLength(5);
    expect(actualStages.map((stage) => stage.dataset.stage)).toEqual([
      "intro",
      "experiences",
      "skills",
      "review",
      "completed",
    ]);
  });

  it("should state each stage's count and its share of the people who entered the funnel", () => {
    // GIVEN a funnel entered by 1,798 people, of whom 502 reach the end
    // WHEN the funnel is rendered
    render(<Funnel label="Conversation funnel" stages={GIVEN_STAGES} />);

    // THEN the first stage is the 100% the rest are read against
    expect(renderedBars()[0]).toHaveTextContent("1,798");
    expect(renderedBars()[0]).toHaveTextContent("100%");
    // AND the last stage carries its own count and share of that entry figure
    expect(renderedBars()[4]).toHaveTextContent("502");
    expect(renderedBars()[4]).toHaveTextContent("28%");
  });

  it("should taper each bar to the share of the entry stage it still holds", () => {
    // GIVEN a funnel that has lost 72% of its entrants by the final stage
    // WHEN the funnel is rendered
    render(<Funnel label="Conversation funnel" stages={GIVEN_STAGES} />);

    // THEN the entry stage spans the full width
    expect(renderedBars()[0]).toHaveStyle({ width: "100%" });
    // AND each later bar is narrowed to its own share
    expect(renderedBars()[1]).toHaveStyle({ width: `${(1546 / 1798) * 100}%` });
    expect(renderedBars()[4]).toHaveStyle({ width: `${(502 / 1798) * 100}%` });
  });

  it("should report how many people were lost between one stage and the next", () => {
    // GIVEN a funnel losing 252 people between Intro and Experiences
    // WHEN the funnel is rendered
    render(<Funnel label="Conversation funnel" stages={GIVEN_STAGES} />);

    // THEN the entry stage has nothing to have dropped off from
    const actualDropOffs = screen.getAllByTestId(DATA_TEST_ID.DROP_OFF);
    expect(actualDropOffs[0]).toBeEmptyDOMElement();
    // AND every later stage reports its loss against the stage before it
    expect(actualDropOffs.slice(1).map((element) => element.textContent)).toEqual(["−252", "−396", "−432", "−216"]);
  });

  it("should not report a drop-off for a stage more people reached than the one before it", () => {
    // GIVEN a stage that more people reached than the previous one
    const givenRecoveringStages: FunnelStage[] = [
      { id: "intro", label: "Intro", value: 100 },
      { id: "resumed", label: "Resumed", value: 120 },
    ];

    // WHEN the funnel is rendered
    render(<Funnel label="Conversation funnel" stages={givenRecoveringStages} />);

    // THEN no loss is claimed
    expect(screen.getAllByTestId(DATA_TEST_ID.DROP_OFF)[1]).toBeEmptyDOMElement();
  });

  it("should offer the same figures as a table, since the plot itself is hidden from assistive tech", () => {
    // GIVEN a five-stage conversation funnel
    // WHEN the funnel is rendered
    render(<Funnel label="Conversation funnel" stages={GIVEN_STAGES} />);

    // THEN the plot is not read out
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER).querySelector("[aria-hidden='true']")).toBeInTheDocument();
    // AND the same numbers are available as a table, captioned with the funnel's label
    const actualTable = within(screen.getByTestId(TABLE_TEST_ID.TABLE));
    expect(screen.getByTestId(TABLE_TEST_ID.TABLE)).toHaveTextContent("Conversation funnel");
    expect(actualTable.getByRole("rowheader", { name: "Experiences" })).toBeInTheDocument();
    expect(actualTable.getByRole("cell", { name: "1,546" })).toBeInTheDocument();
    expect(actualTable.getByRole("cell", { name: "86% of those who started" })).toBeInTheDocument();
    expect(actualTable.getByRole("cell", { name: "−252" })).toBeInTheDocument();
  });

  it("should caption what the bars and the figures beside them mean", () => {
    // GIVEN captions for the two columns
    // WHEN the funnel is rendered
    render(
      <Funnel
        label="Conversation funnel"
        stages={GIVEN_STAGES}
        valueCaption="Reached stage · % of those who started"
        dropOffCaption="Drop-off"
      />
    );

    // THEN both captions sit under the plot
    const actualCaption = screen.getByTestId(DATA_TEST_ID.CAPTION);
    expect(actualCaption).toHaveTextContent("Reached stage · % of those who started");
    expect(actualCaption).toHaveTextContent("Drop-off");
  });

  it("should say there is nothing to plot when the selection produced no stages", () => {
    // GIVEN a selection nobody entered
    // WHEN the funnel is rendered
    render(<Funnel label="Conversation funnel" stages={[]} />);

    // THEN it says so, rather than drawing an empty plot
    expect(screen.getByTestId(DATA_TEST_ID.EMPTY)).toHaveTextContent("No data to show for this selection.");
  });

  it("should say it is loading rather than empty while the first figures are still on their way", () => {
    // GIVEN no stages yet, because the request is still in flight
    // WHEN the funnel is rendered
    render(<Funnel label="Conversation funnel" stages={[]} isLoading />);

    // THEN it reads as loading, not as an empty selection
    expect(screen.getByTestId(DATA_TEST_ID.EMPTY)).toHaveTextContent("Loading…");
  });
});
