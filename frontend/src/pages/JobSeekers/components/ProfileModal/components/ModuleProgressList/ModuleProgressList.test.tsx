import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { MODULE_IDS } from "@/access/AccessContext";
import type { JobseekerModuleProgress } from "@/jobseekers/jobseekers.types";
import { DATA_TEST_ID, ModuleProgressList } from "./ModuleProgressList";

const GIVEN_STEPS = [
  { id: "cv-builder", name: "CV Builder", status: "completed" as const },
  { id: "interview-prep", name: "Interview Prep", status: "in_progress" as const },
  { id: "workplace-skills", name: "Workplace Skills", status: "not_started" as const },
];

const GIVEN_MODULES: JobseekerModuleProgress[] = [
  { module_id: MODULE_IDS.BUILD_YOUR_PROFILE, status: "in_progress", phase: "Skills" },
  { module_id: MODULE_IDS.JOB_READINESS, status: "in_progress", sub_modules: GIVEN_STEPS },
  { module_id: MODULE_IDS.CAREER_EXPLORER, status: "not_started" },
  { module_id: MODULE_IDS.JOBS, status: "completed" },
];

/** The row for one module, addressed the way the screen addresses it — by module, not by position. */
function rowFor(moduleId: string): HTMLElement {
  const row = screen.getAllByTestId(DATA_TEST_ID.ROW).find((candidate) => candidate.dataset.module === moduleId);
  if (!row) throw new Error(`No progress row rendered for module "${moduleId}"`);
  return row;
}

describe("ModuleProgressList", () => {
  it("should name every module the jobseeker's progress was reported for, in the order given", () => {
    // GIVEN a jobseeker part way through the suite
    // WHEN their progress is rendered
    render(<ModuleProgressList modules={GIVEN_MODULES} />);

    // THEN there is one row per module, each named
    const actualRows = screen.getAllByTestId(DATA_TEST_ID.ROW);
    expect(actualRows).toHaveLength(GIVEN_MODULES.length);
    expect(actualRows.map((row) => row.dataset.module)).toEqual([
      MODULE_IDS.BUILD_YOUR_PROFILE,
      MODULE_IDS.JOB_READINESS,
      MODULE_IDS.CAREER_EXPLORER,
      MODULE_IDS.JOBS,
    ]);
    expect(within(actualRows[0]).getByText("Build Your Profile")).toBeInTheDocument();
    expect(within(actualRows[3]).getByText("Jobs")).toBeInTheDocument();
  });

  it("should say where a jobseeker stands in a module that has no steps", () => {
    // GIVEN a jobseeker who finished Jobs and never opened Career Explorer
    // WHEN their progress is rendered
    render(<ModuleProgressList modules={GIVEN_MODULES} />);

    // THEN each of those modules reports its own status
    expect(within(rowFor(MODULE_IDS.JOBS)).getByText("Completed")).toBeInTheDocument();
    expect(within(rowFor(MODULE_IDS.CAREER_EXPLORER)).getByText("Not started")).toBeInTheDocument();
  });

  it("should say which phase of Build Your Profile they stopped in", () => {
    // GIVEN a jobseeker who stopped in the Skills phase
    // WHEN their progress is rendered
    render(<ModuleProgressList modules={GIVEN_MODULES} />);

    // THEN the phase is named on that module's row
    expect(within(rowFor(MODULE_IDS.BUILD_YOUR_PROFILE)).getByText("Phase: Skills")).toBeInTheDocument();
  });

  it("should not claim a phase for a module that never reports one", () => {
    // GIVEN a jobseeker part way through Job Readiness, which has phases in no deployment
    const givenModules: JobseekerModuleProgress[] = [
      { module_id: MODULE_IDS.JOB_READINESS, status: "in_progress", phase: "Skills" },
    ];

    // WHEN their progress is rendered
    render(<ModuleProgressList modules={givenModules} />);

    // THEN no phase is shown, even though one came back on the payload
    expect(screen.queryByText("Phase: Skills")).not.toBeInTheDocument();
  });

  it("should count the steps completed in a started module, instead of one blanket status", () => {
    // GIVEN a jobseeker who has completed one of Job Readiness' three steps
    // WHEN their progress is rendered
    render(<ModuleProgressList modules={GIVEN_MODULES} />);

    // THEN the row counts the completed steps against the total
    const row = within(rowFor(MODULE_IDS.JOB_READINESS));
    expect(row.getByTestId(DATA_TEST_ID.SUB_MODULE_COUNT)).toHaveTextContent("1/3 modules completed");
    // AND the blanket "in progress" badge is not shown alongside it — only the steps carry a status
    expect(row.queryByText("In progress", { selector: "[data-slot='badge']" })).not.toBeInTheDocument();
  });

  it("should list every step of a started module by name, with where the jobseeker stands in it", () => {
    // GIVEN a jobseeker part way through Job Readiness
    // WHEN their progress is rendered
    render(<ModuleProgressList modules={GIVEN_MODULES} />);

    // THEN each step is named
    const actualSteps = within(rowFor(MODULE_IDS.JOB_READINESS)).getAllByTestId(DATA_TEST_ID.SUB_MODULE);
    expect(actualSteps.map((step) => step.textContent)).toEqual([
      "CV BuilderCompleted",
      "Interview PrepIn progress",
      "Workplace SkillsNot started",
    ]);
  });

  it("should keep the steps of a module they have not opened out of sight", () => {
    // GIVEN a jobseeker who has not started Job Readiness, whose steps came back all the same
    const givenModules: JobseekerModuleProgress[] = [
      { module_id: MODULE_IDS.JOB_READINESS, status: "not_started", sub_modules: GIVEN_STEPS },
    ];

    // WHEN their progress is rendered
    render(<ModuleProgressList modules={givenModules} />);

    // THEN no steps are listed — a module never opened has nothing to break down
    expect(screen.queryAllByTestId(DATA_TEST_ID.SUB_MODULE)).toHaveLength(0);
    expect(screen.queryByTestId(DATA_TEST_ID.SUB_MODULE_COUNT)).not.toBeInTheDocument();
    // AND the module reports the one status it has
    expect(screen.getByText("Not started")).toBeInTheDocument();
  });

  it("should fall back to the module's own status when its steps came back empty", () => {
    // GIVEN a started module whose steps the endpoint reported as none
    const givenModules: JobseekerModuleProgress[] = [
      { module_id: MODULE_IDS.JOB_READINESS, status: "in_progress", sub_modules: [] },
    ];

    // WHEN their progress is rendered
    render(<ModuleProgressList modules={givenModules} />);

    // THEN the row says "in progress" rather than counting 0/0
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.SUB_MODULE_COUNT)).not.toBeInTheDocument();
  });

  it("should count every step of a module the jobseeker has finished", () => {
    // GIVEN a jobseeker who completed Job Readiness and each of its steps
    const givenModules: JobseekerModuleProgress[] = [
      {
        module_id: MODULE_IDS.JOB_READINESS,
        status: "completed",
        sub_modules: GIVEN_STEPS.map((step) => ({ ...step, status: "completed" as const })),
      },
    ];

    // WHEN their progress is rendered
    render(<ModuleProgressList modules={givenModules} />);

    // THEN the count reports the whole module done
    expect(screen.getByTestId(DATA_TEST_ID.SUB_MODULE_COUNT)).toHaveTextContent("3/3 modules completed");
  });

  it("should render an empty list when no module progress was reported", () => {
    // GIVEN a deployment that reported no modules for this jobseeker
    // WHEN their progress is rendered
    render(<ModuleProgressList modules={[]} />);

    // THEN the list is there but holds no rows, so the section renders without breaking
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toBeEmptyDOMElement();
  });
});
