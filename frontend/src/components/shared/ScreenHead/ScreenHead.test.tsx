import { describe, expect, it } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import { ScreenHead, DATA_TEST_ID } from "./ScreenHead";

describe("ScreenHead", () => {
  it("should render the title as the screen's top-level heading", () => {
    // GIVEN a screen with only a title
    // WHEN rendered
    render(<ScreenHead title="Overview" />);

    // THEN the title is the h1
    expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
  });

  it("should omit the eyebrow and description when they aren't provided", () => {
    // GIVEN a screen with only a title
    // WHEN rendered
    render(<ScreenHead title="Overview" />);

    // THEN neither optional line is in the document
    expect(screen.queryByTestId(DATA_TEST_ID.EYEBROW)).not.toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.DESCRIPTION)).not.toBeInTheDocument();
  });

  it("should render the eyebrow above the title when provided", () => {
    // GIVEN a screen with an eyebrow
    // WHEN rendered
    render(<ScreenHead eyebrow="Deployment overview" title="Overview" />);

    // THEN the eyebrow shows alongside the title
    expect(screen.getByText("Deployment overview")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
  });

  it("should render the description when provided", () => {
    // GIVEN a screen with a description
    // WHEN rendered
    render(<ScreenHead title="Jobseekers" description="Every jobseeker in scope, one per row." />);

    // THEN the description shows
    expect(screen.getByText("Every jobseeker in scope, one per row.")).toBeInTheDocument();
  });

  it("should render the eyebrow, title and description together", () => {
    // GIVEN a screen with all three parts
    // WHEN rendered
    render(<ScreenHead eyebrow="Individual view" title="Jobseekers" description="One row per jobseeker." />);

    // THEN all three show
    expect(screen.getByText("Individual view")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Jobseekers" })).toBeInTheDocument();
    expect(screen.getByText("One row per jobseeker.")).toBeInTheDocument();
  });
});
