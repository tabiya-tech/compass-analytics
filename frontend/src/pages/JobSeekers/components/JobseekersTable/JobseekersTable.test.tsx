import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { MODULE_IDS } from "@/access/AccessContext";
import type { JobseekerSummary, JobseekersSort } from "@/jobseekers/jobseekers.types";
import { getJobseekerColumns } from "./columns";
import { DATA_TEST_ID, JobseekersTable, type JobseekersTableProps } from "./JobseekersTable";

const givenCompletedJobseeker: JobseekerSummary = {
  id: "JS-10230",
  name: "María González",
  institution_id: "inst-1",
  institution_name: "Mazabuka Livelihoods Trust",
  profile_score_pct: 100,
  registered_at: "2026-02-05",
  last_login_at: "2026-07-04",
  module_status: {
    [MODULE_IDS.BUILD_YOUR_PROFILE]: "completed",
    [MODULE_IDS.JOB_READINESS]: "in_progress",
    [MODULE_IDS.CAREER_EXPLORER]: "not_started",
  },
  skills_report_ready: true,
  skills: ["Customer service", "Cash handling"],
};

const givenUnstartedJobseeker: JobseekerSummary = {
  id: "JS-10242",
  name: "Kabelo Molefe",
  institution_id: "inst-1",
  institution_name: "Mazabuka Livelihoods Trust",
  profile_score_pct: 0,
  registered_at: "2026-03-28",
  last_login_at: "2026-04-10",
  module_status: {},
  skills_report_ready: false,
  skills: [],
};

const givenSort: JobseekersSort = { by: "name", direction: "asc" };

function renderTable(overrides: Partial<JobseekersTableProps> = {}) {
  const props: JobseekersTableProps = {
    jobseekers: [givenCompletedJobseeker, givenUnstartedJobseeker],
    columns: getJobseekerColumns(Object.values(MODULE_IDS)),
    sort: givenSort,
    onSortChange: vi.fn(),
    moduleStatusFilters: {},
    onModuleStatusFiltersChange: vi.fn(),
    onClearFilters: vi.fn(),
    onJobseekerSelect: vi.fn(),
    onSkillsSelect: vi.fn(),
    ...overrides,
  };
  render(<JobseekersTable {...props} />);
  return props;
}

function rowOf(name: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(name) }).closest("tr") as HTMLElement;
}

describe("JobseekersTable", () => {
  it("should identify each jobseeker by name and id, and report their score and dates", () => {
    // GIVEN two jobseekers
    // WHEN the roster is rendered
    renderTable();

    // THEN the first is identified by both name and id
    const row = within(rowOf("María González"));
    expect(row.getByRole("button", { name: /María González/ })).toBeInTheDocument();
    expect(row.getByText("JS-10230")).toBeInTheDocument();
    // AND their score and dates read as the roster formats them
    expect(row.getByText("100%")).toBeInTheDocument();
    expect(row.getByText("05 Feb 2026")).toBeInTheDocument();
    expect(row.getByText("04 Jul 2026")).toBeInTheDocument();
  });

  it("should show a dash rather than a blank cell where a date was never recorded", () => {
    // GIVEN a jobseeker who has registered but never logged in
    const givenNeverLoggedIn: JobseekerSummary = { ...givenUnstartedJobseeker, last_login_at: null };

    // WHEN the roster is rendered
    renderTable({ jobseekers: [givenNeverLoggedIn] });

    // THEN the missing date reads as a dash, which is legible, rather than an empty cell that looks broken
    const cells = within(rowOf("Kabelo Molefe")).getAllByTestId(DATA_TEST_ID.CELL);
    expect(cells.find((cell) => cell.dataset.column === "last_login_at")?.textContent).toBe("\u2014");
  });

  it("should say where each jobseeker stands in every module column", () => {
    // GIVEN a jobseeker part-way through the suite
    // WHEN the roster is rendered
    renderTable();

    // THEN each module column reports that module's own status
    const cells = within(rowOf("María González")).getAllByTestId(DATA_TEST_ID.CELL);
    const statusOf = (moduleId: string) => cells.find((cell) => cell.dataset.column === moduleId)?.textContent;
    expect(statusOf(MODULE_IDS.BUILD_YOUR_PROFILE)).toBe("Completed");
    expect(statusOf(MODULE_IDS.JOB_READINESS)).toBe("In progress");
    expect(statusOf(MODULE_IDS.CAREER_EXPLORER)).toBe("Not started");
  });

  it("should offer the skills report only to the jobseekers who have one", () => {
    // GIVEN one jobseeker with a finished report and one without
    // WHEN the roster is rendered
    renderTable();

    // THEN the finished report is offered as a count of skills
    expect(within(rowOf("María González")).getByRole("button", { name: "2 skills" })).toBeInTheDocument();
    // AND the unfinished one says so instead
    expect(within(rowOf("Kabelo Molefe")).getByText("Report not ready")).toBeInTheDocument();
  });

  it("should say what the button does when the roster carries no skill count", () => {
    // GIVEN a jobseeker whose report is ready but whose skills the roster does not carry
    const givenNoCount: JobseekerSummary = { ...givenCompletedJobseeker, skills: [] };

    // WHEN the roster is rendered
    renderTable({ jobseekers: [givenNoCount] });

    // THEN the button says what it opens rather than counting to zero
    expect(within(rowOf("María González")).getByRole("button", { name: "View skills" })).toBeInTheDocument();
  });

  it("should open a jobseeker's profile when their name is clicked", async () => {
    // GIVEN the rendered roster
    const props = renderTable();

    // WHEN a jobseeker's name is clicked
    await userEvent.click(screen.getByRole("button", { name: /María González/ }));

    // THEN that jobseeker is handed on to be opened
    expect(props.onJobseekerSelect).toHaveBeenCalledWith(givenCompletedJobseeker);
  });

  it("should open the skills report without also opening the profile", async () => {
    // GIVEN the rendered roster
    const props = renderTable();

    // WHEN the skills button is clicked
    await userEvent.click(within(rowOf("María González")).getByTestId(DATA_TEST_ID.SKILLS_BUTTON));

    // THEN only the report is asked for — the click does not fall through to the row
    expect(props.onSkillsSelect).toHaveBeenCalledWith(givenCompletedJobseeker);
    expect(props.onJobseekerSelect).not.toHaveBeenCalled();
  });

  it("should flip the direction when the sorted column is clicked again", async () => {
    // GIVEN a roster already sorted by name, A–Z
    const props = renderTable();

    // WHEN that same column is sorted again
    await userEvent.click(screen.getByRole("button", { name: "Sort by Jobseeker" }));

    // THEN it flips to Z–A
    expect(props.onSortChange).toHaveBeenCalledWith({ by: "name", direction: "desc" });
  });

  it("should start a newly sorted figure at its highest value rather than its lowest", async () => {
    // GIVEN a roster sorted by name
    const props = renderTable();

    // WHEN the profile score column is sorted
    await userEvent.click(screen.getByRole("button", { name: "Sort by Profile score" }));

    // THEN the fullest profiles come first, which is what a reader looks for
    expect(props.onSortChange).toHaveBeenCalledWith({ by: "profile_score_pct", direction: "desc" });
  });

  it("should keep each module's status filter to that module", async () => {
    // GIVEN a roster with Career Explorer already filtered
    const props = renderTable({ moduleStatusFilters: { [MODULE_IDS.CAREER_EXPLORER]: ["completed"] } });

    // WHEN Build Your Profile is filtered to the jobseekers still working through it
    await userEvent.click(screen.getByRole("button", { name: "Filter by Build Your Profile" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "In progress" }));

    // THEN the new filter is added without disturbing the one already set
    expect(props.onModuleStatusFiltersChange).toHaveBeenCalledWith({
      [MODULE_IDS.CAREER_EXPLORER]: ["completed"],
      [MODULE_IDS.BUILD_YOUR_PROFILE]: ["in_progress"],
    });
  });

  it("should explain an empty roster and offer a way back to the full one", async () => {
    // GIVEN a roster nothing matched
    const props = renderTable({ jobseekers: [] });

    // THEN the empty state explains why
    expect(screen.getByRole("status")).toHaveTextContent("No jobseekers match your search or filters.");

    // WHEN the way back is taken
    await userEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));

    // THEN the search and filters are cleared
    expect(props.onClearFilters).toHaveBeenCalled();
  });
});
