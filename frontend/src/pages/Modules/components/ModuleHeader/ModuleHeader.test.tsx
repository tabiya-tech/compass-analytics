import { describe, expect, it } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import { MODULE_IDS } from "@/access/AccessContext";
import { ModuleHeader, DATA_TEST_ID } from "./ModuleHeader";

describe("ModuleHeader", () => {
  it("should introduce Build Your Profile with the question its figures answer", () => {
    // GIVEN the Build Your Profile module
    // WHEN its header is rendered
    render(<ModuleHeader moduleId={MODULE_IDS.BUILD_YOUR_PROFILE} />);

    // THEN it is headed by the question, over the module's place in the suite
    expect(screen.getByTestId(DATA_TEST_ID.EYEBROW)).toHaveTextContent("Build Your Profile · Compass core");
    expect(screen.getByRole("heading", { level: 2, name: "Are people building their profiles?" })).toBeInTheDocument();
  });

  it.each([
    [MODULE_IDS.JOB_READINESS, "Job readiness · Get job ready", "Are people completing the job-readiness courses?"],
    [MODULE_IDS.CAREER_EXPLORER, "Career Explorer · Discovery", "Are people exploring careers?"],
    [MODULE_IDS.JOBS, "Jobs · Classifier & matching", "Are people finding and acting on jobs?"],
  ])("should introduce %s with its own eyebrow and question", (givenModuleId, expectedEyebrow, expectedHeadline) => {
    // GIVEN one of the deployed modules
    // WHEN its header is rendered
    render(<ModuleHeader moduleId={givenModuleId} />);

    // THEN the copy is the module's own
    expect(screen.getByTestId(DATA_TEST_ID.EYEBROW)).toHaveTextContent(expectedEyebrow);
    expect(screen.getByRole("heading", { level: 2, name: expectedHeadline })).toBeInTheDocument();
  });

  it("should mark the module it heads, and keep its icon out of the reading order", () => {
    // GIVEN the Jobs module
    // WHEN its header is rendered
    render(<ModuleHeader moduleId={MODULE_IDS.JOBS} />);

    // THEN the header says which module it belongs to
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toHaveAttribute("data-module", "jobs");
    // AND the icon is decoration, not something to read out alongside the headline
    expect(screen.getByTestId(DATA_TEST_ID.ICON)).toHaveAttribute("aria-hidden", "true");
  });
});
