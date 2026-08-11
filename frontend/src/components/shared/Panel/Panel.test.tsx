import { describe, expect, it } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import { Panel, DATA_TEST_ID } from "./Panel";

describe("Panel", () => {
  it("should render the title as a second-level heading, with the body inside it", () => {
    // GIVEN a panel with a body
    // WHEN rendered
    render(
      <Panel title="Reach over time">
        <p>chart</p>
      </Panel>
    );

    // THEN the title is a heading under the screen's own, and the body shows
    expect(screen.getByRole("heading", { level: 2, name: "Reach over time" })).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.CONTENT)).toHaveTextContent("chart");
  });

  it("should render only the title when nothing optional is passed", () => {
    // GIVEN a panel with no description, action or footnote
    // WHEN rendered
    render(<Panel title="Reach over time">chart</Panel>);

    // THEN none of the optional slots are filled
    expect(screen.queryByTestId(DATA_TEST_ID.DESCRIPTION)).not.toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.ACTION)).not.toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.FOOTNOTE)).not.toBeInTheDocument();
  });

  it("should render the description under the title", () => {
    // GIVEN a panel that explains what it plots
    // WHEN rendered
    render(
      <Panel title="Reach over time" description="New and returning users, by month">
        chart
      </Panel>
    );

    // THEN the description shows
    expect(screen.getByTestId(DATA_TEST_ID.DESCRIPTION)).toHaveTextContent("New and returning users, by month");
  });

  it("should render the panel's own controls in the header, not in the body", () => {
    // GIVEN a panel with its own controls
    // WHEN rendered
    render(
      <Panel title="Reach over time" action={<button type="button">Change dates</button>}>
        chart
      </Panel>
    );

    // THEN the controls sit in the action slot, away from the body
    const actualAction = screen.getByTestId(DATA_TEST_ID.ACTION);
    expect(actualAction).toContainElement(screen.getByRole("button", { name: "Change dates" }));
    expect(screen.getByTestId(DATA_TEST_ID.CONTENT)).not.toContainElement(actualAction);
  });

  it("should mark itself busy while its figures are being refetched", () => {
    // GIVEN a panel whose data is being refetched
    // WHEN rendered
    render(
      <Panel title="Reach over time" isLoading>
        chart
      </Panel>
    );

    // THEN it says so, while keeping the figures it already has on screen
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId(DATA_TEST_ID.CONTENT)).toHaveTextContent("chart");
  });

  it("should render the footnote below the body", () => {
    // GIVEN a panel with a note on how to read it
    // WHEN rendered
    render(
      <Panel title="How they log in" footnote="Center figure = avg logins / user">
        chart
      </Panel>
    );

    // THEN the note shows
    expect(screen.getByTestId(DATA_TEST_ID.FOOTNOTE)).toHaveTextContent("Center figure = avg logins / user");
  });
});
