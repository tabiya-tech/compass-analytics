import { describe, expect, it } from "vitest";
import { act, render, screen, userEvent, within } from "@/_test_utilities/test-utils";
import { reportElementsOnScreen } from "@/test/setup";
import { MODULE_IDS, type ModuleId } from "@/access/AccessContext";
import { moduleSectionElementId } from "@/pages/Modules/utils";
import { ModuleTimeline, DATA_TEST_ID, pickActiveModule, type ModuleTimelineItem } from "./ModuleTimeline";

const WHOLE_SUITE: ModuleTimelineItem[] = [
  { id: MODULE_IDS.BUILD_YOUR_PROFILE, startedPercentage: 44 },
  { id: MODULE_IDS.JOB_READINESS, startedPercentage: 34 },
  { id: MODULE_IDS.CAREER_EXPLORER, startedPercentage: 18 },
  { id: MODULE_IDS.JOBS, startedPercentage: 26 },
];

/** The timeline follows the sections on the screen around it, so a test needs them on the page. */
function renderTimelineOverSections(modules: readonly ModuleTimelineItem[] = WHOLE_SUITE) {
  return render(
    <>
      <ModuleTimeline modules={modules} />
      {modules.map((module) => (
        <section key={module.id} id={moduleSectionElementId(module.id)} />
      ))}
    </>
  );
}

function stepFor(moduleId: ModuleId): HTMLElement {
  return screen.getAllByTestId(DATA_TEST_ID.STEP).find((step) => step.dataset.module === moduleId)!;
}

function activeModuleOnScreen(): string | undefined {
  return screen.getAllByTestId(DATA_TEST_ID.STEP).find((step) => step.dataset.active === "true")?.dataset.module;
}

function scrollTo(...moduleIds: ModuleId[]) {
  act(() => reportElementsOnScreen(...moduleIds.map((id) => document.getElementById(moduleSectionElementId(id)))));
}

describe("ModuleTimeline", () => {
  it("should step through the modules in the order the deployment runs them", () => {
    // GIVEN a deployment running the whole suite
    // WHEN the timeline is rendered
    renderTimelineOverSections();

    // THEN there is a step per module, in that order, joined by a rail between each pair
    expect(screen.getAllByTestId(DATA_TEST_ID.STEP).map((step) => step.dataset.module)).toEqual([
      "build-your-profile",
      "job-readiness",
      "career-explorer",
      "jobs",
    ]);
    expect(screen.getAllByTestId(DATA_TEST_ID.CONNECTOR)).toHaveLength(3);
  });

  it("should name each module and the share of jobseekers who started it", () => {
    // GIVEN Job readiness started by 34% of jobseekers in scope
    // WHEN the timeline is rendered
    renderTimelineOverSections();

    // THEN its step carries both the name and the share
    const actualStep = within(stepFor(MODULE_IDS.JOB_READINESS));
    expect(actualStep.getByTestId(DATA_TEST_ID.STEP_LABEL)).toHaveTextContent("Job readiness");
    expect(actualStep.getByTestId(DATA_TEST_ID.STEP_STARTED)).toHaveTextContent("34% started");
  });

  it("should start on the deployment's first module, before anything has been scrolled", () => {
    // GIVEN a deployment running the whole suite
    // WHEN the timeline is rendered
    renderTimelineOverSections();

    // THEN the first module is the one being read, and it is the only current step
    expect(screen.getAllByTestId(DATA_TEST_ID.STEP).filter((step) => step.dataset.active === "true")).toHaveLength(1);
    expect(activeModuleOnScreen()).toBe("build-your-profile");
    expect(within(stepFor(MODULE_IDS.BUILD_YOUR_PROFILE)).getByRole("button")).toHaveAttribute("aria-current", "true");
  });

  it("should light the step of whichever module has been scrolled to", () => {
    // GIVEN the whole suite on screen
    renderTimelineOverSections();

    // WHEN the reader scrolls into Career Explorer, with the tail of Job readiness still above it
    scrollTo(MODULE_IDS.JOB_READINESS, MODULE_IDS.CAREER_EXPLORER);

    // THEN the module being moved into is the one lit
    expect(activeModuleOnScreen()).toBe("career-explorer");

    // WHEN the reader carries on into Jobs
    scrollTo(MODULE_IDS.JOBS);

    // THEN the timeline follows
    expect(activeModuleOnScreen()).toBe("jobs");
  });

  it("should keep the last module lit while the reader is between two sections", () => {
    // GIVEN the reader has scrolled to Job readiness
    renderTimelineOverSections();
    scrollTo(MODULE_IDS.JOB_READINESS);

    // WHEN they scroll into the gap between two sections, with neither in the band
    scrollTo();

    // THEN the timeline doesn't go blank — the last module still stands
    expect(activeModuleOnScreen()).toBe("job-readiness");
  });

  it("should scroll to a module's figures when its step is pressed, and light it straight away", async () => {
    // GIVEN the whole suite on screen
    const givenScrolledInto: Element[] = [];
    Element.prototype.scrollIntoView = function () {
      givenScrolledInto.push(this);
    };
    renderTimelineOverSections();

    // WHEN the Jobs step is pressed
    await userEvent.click(within(stepFor(MODULE_IDS.JOBS)).getByRole("button"));

    // THEN that module's section is scrolled to, and its step is lit without waiting for the scroll to land
    expect(givenScrolledInto).toContain(document.getElementById(moduleSectionElementId(MODULE_IDS.JOBS)));
    expect(activeModuleOnScreen()).toBe("jobs");
  });
});

describe("pickActiveModule", () => {
  it("should pick the module being moved into when it and the one before it are both in the band", () => {
    // GIVEN a sliver of Job readiness and the top of Career Explorer both in the band
    // WHEN the active module is picked
    const actualModuleId = pickActiveModule(
      WHOLE_SUITE.map((module) => module.id),
      new Set(["module-section-career-explorer", "module-section-job-readiness"])
    );

    // THEN the module being moved into wins, whatever order the observer reported them in
    expect(actualModuleId).toBe("career-explorer");
  });

  it("should name nothing while no section of this deployment is in the band", () => {
    // GIVEN a two-module deployment with only a stale Jobs section in the band
    // WHEN the active module is picked
    const actualModuleId = pickActiveModule(
      [MODULE_IDS.BUILD_YOUR_PROFILE, MODULE_IDS.CAREER_EXPLORER],
      new Set(["module-section-jobs"])
    );

    // THEN nothing is named, and the last answer is left standing
    expect(actualModuleId).toBeNull();
  });
});
