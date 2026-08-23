import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { AccessProvider, MODULE_IDS } from "@/access/AccessContext";
import type { JobseekerDetail } from "@/jobseekers/jobseekers.types";
import type { JobseekerDetailState } from "@/pages/JobSeekers/hooks/useJobseekerDetail";
import { DATA_TEST_ID, ProfileModal } from "./ProfileModal";

const givenDetail: JobseekerDetail = {
  id: "JS-10230",
  name: "María González",
  institution_id: "inst-1",
  institution_name: "Mazabuka Livelihoods Trust",
  profile_score_pct: 70,
  demographics: { gender: "Female", age: 24, location: "Mazabuka", education: "Secondary" },
  login_activity: {
    registered_at: "2026-02-05",
    last_login_at: "2026-07-04",
    total_logins: 14,
    login_method: "google",
  },
  modules: [
    { module_id: MODULE_IDS.BUILD_YOUR_PROFILE, status: "in_progress", phase: "Skills" },
    {
      module_id: MODULE_IDS.JOB_READINESS,
      status: "in_progress",
      sub_modules: [
        { id: "cv-builder", name: "CV Builder", status: "completed" },
        { id: "interview-prep", name: "Interview Prep", status: "in_progress" },
        { id: "workplace-skills", name: "Workplace Skills", status: "not_started" },
      ],
    },
    { module_id: MODULE_IDS.CAREER_EXPLORER, status: "not_started" },
    { module_id: MODULE_IDS.JOBS, status: "completed" },
  ],
  outputs: { skills_report_generated: true, downloaded: true, shared: false },
  skills: ["Customer service", "Cash handling"],
};

function renderProfile(state: JobseekerDetailState, activeModules?: (typeof MODULE_IDS)[keyof typeof MODULE_IDS][]) {
  const onViewSkills = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <AccessProvider activeModules={activeModules}>
      <ProfileModal open state={state} onOpenChange={onOpenChange} onViewSkills={onViewSkills} />
    </AccessProvider>
  );
  return { onViewSkills, onOpenChange };
}

describe("ProfileModal", () => {
  it("should head the profile with who the jobseeker is and how full their profile is", () => {
    // GIVEN a fetched profile
    // WHEN it is opened
    renderProfile({ status: "success", data: givenDetail });

    // THEN the header names them, their id and their institution
    const header = within(screen.getByTestId(DATA_TEST_ID.HEADER));
    expect(header.getByRole("heading", { name: "María González" })).toBeInTheDocument();
    expect(header.getByText("JS-10230 · Mazabuka Livelihoods Trust")).toBeInTheDocument();
    // AND their profile score is shown as a ring
    expect(header.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "70");
  });

  it("should report who they are and how they have been logging in", () => {
    // GIVEN a fetched profile
    // WHEN it is opened
    renderProfile({ status: "success", data: givenDetail });

    // THEN their demographics are listed
    const identity = within(screen.getByTestId(DATA_TEST_ID.IDENTITY));
    expect(identity.getByText("Female")).toBeInTheDocument();
    expect(identity.getByText("24")).toBeInTheDocument();
    expect(identity.getByText("Mazabuka")).toBeInTheDocument();
    expect(identity.getByText("Secondary")).toBeInTheDocument();
    // AND their login history is reported alongside it
    const login = within(screen.getByTestId(DATA_TEST_ID.LOGIN_ACTIVITY));
    expect(login.getByText("05 Feb 2026")).toBeInTheDocument();
    expect(login.getByText("04 Jul 2026")).toBeInTheDocument();
    expect(login.getByText("14")).toBeInTheDocument();
    expect(login.getByText("Google")).toBeInTheDocument();
  });

  it("should break Job Readiness down into the steps they have worked through", () => {
    // GIVEN a jobseeker part-way through Job Readiness
    // WHEN their profile is opened
    renderProfile({ status: "success", data: givenDetail });

    // THEN the module reports how many of its steps are done
    const progress = within(screen.getByTestId(DATA_TEST_ID.PROGRESS));
    expect(progress.getByText("1/3 modules completed")).toBeInTheDocument();
    // AND each step reports its own status
    expect(progress.getByText("CV Builder")).toBeInTheDocument();
    expect(progress.getByText("Interview Prep")).toBeInTheDocument();
    // AND where they stopped inside Build Your Profile is named
    expect(progress.getByText("Phase: Skills")).toBeInTheDocument();
  });

  it("should show progress only for the modules the deployment runs", () => {
    // GIVEN a deployment running Build Your Profile only
    // WHEN a profile is opened
    renderProfile({ status: "success", data: givenDetail }, [MODULE_IDS.BUILD_YOUR_PROFILE]);

    // THEN the modules it does not run are left out, however much the endpoint reported
    const progress = within(screen.getByTestId(DATA_TEST_ID.PROGRESS));
    expect(progress.getByText("Build Your Profile")).toBeInTheDocument();
    expect(progress.queryByText("Career Explorer")).not.toBeInTheDocument();
    expect(progress.queryByText("CV Builder")).not.toBeInTheDocument();
  });

  it("should say what Build Your Profile produced and what they did with it", () => {
    // GIVEN a jobseeker who generated and downloaded their report but never shared it
    // WHEN their profile is opened
    renderProfile({ status: "success", data: givenDetail });

    // THEN each output is answered in turn
    const outputs = within(screen.getByTestId(DATA_TEST_ID.OUTPUTS)).getAllByRole("definition");
    expect(outputs.map((output) => output.textContent)).toEqual(["Yes", "Yes", "No"]);
  });

  it("should hand the elicited skills on to be listed in full", async () => {
    // GIVEN a profile with skills captured
    const { onViewSkills } = renderProfile({ status: "success", data: givenDetail });
    expect(screen.getByTestId(DATA_TEST_ID.SKILLS)).toHaveTextContent(
      "2 skills captured in the completed Skills Report."
    );

    // WHEN all the skills are asked for
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.VIEW_SKILLS));

    // THEN the profile is handed on, so the skills report can be opened over it
    expect(onViewSkills).toHaveBeenCalledWith(givenDetail);
  });

  it("should explain why there are no skills yet rather than offer an empty report", () => {
    // GIVEN a jobseeker who has not completed Build Your Profile
    const givenUnfinished: JobseekerDetail = {
      ...givenDetail,
      skills: [],
      outputs: { skills_report_generated: false, downloaded: false, shared: false },
    };

    // WHEN their profile is opened
    renderProfile({ status: "success", data: givenUnfinished });

    // THEN the reason is given, and nothing is offered to open
    expect(screen.getByTestId(DATA_TEST_ID.SKILLS)).toHaveTextContent(
      "No skills yet — the Skills Report is ready once they complete Build Your Profile."
    );
    expect(screen.queryByTestId(DATA_TEST_ID.VIEW_SKILLS)).not.toBeInTheDocument();
  });

  it("should stand in for the profile while it is still being fetched", () => {
    // GIVEN a profile that has not arrived yet
    // WHEN the modal is opened
    renderProfile({ status: "loading" });

    // THEN a skeleton holds its place, and the dialog is still named
    expect(screen.getByTestId(DATA_TEST_ID.LOADING)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Jobseeker profile" })).toBeInTheDocument();
  });

  it("should explain a failed profile and offer to fetch it again", async () => {
    // GIVEN a profile that failed to load
    const retry = vi.fn();
    renderProfile({ status: "error", retry });
    expect(screen.getByTestId(DATA_TEST_ID.ERROR)).toHaveTextContent("Failed to load this jobseeker's profile.");

    // WHEN the retry is taken
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    // THEN it is fetched again
    expect(retry).toHaveBeenCalled();
  });

  it("should close when dismissed", async () => {
    // GIVEN an open profile
    const { onOpenChange } = renderProfile({ status: "success", data: givenDetail });

    // WHEN it is dismissed
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.CLOSE));

    // THEN the screen is told to close it
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
