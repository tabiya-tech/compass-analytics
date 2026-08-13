import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { MODULE_IDS } from "@/access/AccessContext";
import type { InstitutionDetail } from "@/institutions/institutions.types";
import type { InstitutionDetailState } from "@/pages/Institutions/hooks/useInstitutionDetail";
import { DATA_TEST_ID as MODULE_TEST_ID } from "./components/ModuleProgress";
import { DATA_TEST_ID, InstitutionModal } from "./InstitutionModal";

const GIVEN_DETAIL: InstitutionDetail = {
  id: "inst-2",
  name: "Chipata Vocational Centre",
  city: "Chipata",
  region: "Eastern",
  lead_pm: "Isaac Chirwa",
  profile_score_pct: 28,
  reach: {
    registered_users: 4339,
    active_users_30d: 1810,
    top_age_band: "18–24",
    largest_group: "Women",
    most_common_education: "Secondary",
  },
  login_activity: {
    avg_logins_per_user: 3.4,
    total_logins: 8733,
    avg_session_minutes: 8,
    google_login_pct: 58,
    email_login_pct: 42,
  },
  modules: [
    { module_id: MODULE_IDS.BUILD_YOUR_PROFILE, started_pct: 52, highlight_value: 634 },
    {
      module_id: MODULE_IDS.JOB_READINESS,
      started_pct: 37,
      sub_modules: [
        { id: "cv-builder", name: "CV Builder", started: 1618, completed_pct: 47 },
        { id: "interview-prep", name: "Interview Prep", started: 1164, completed_pct: 63 },
      ],
    },
    { module_id: MODULE_IDS.CAREER_EXPLORER, started_pct: 22, highlight_value: 973 },
    { module_id: MODULE_IDS.JOBS, started_pct: 34, highlight_value: 1290 },
  ],
  outputs: {
    skills_reports_generated: 634,
    downloaded: 394,
    jobs_sourced: 19_500,
    avg_time_to_complete_minutes: 12.3,
    target_minutes: 15,
  },
};

function renderModal(state: InstitutionDetailState = { status: "success", data: GIVEN_DETAIL }, open = true) {
  const onOpenChange = vi.fn();
  render(<InstitutionModal open={open} state={state} onOpenChange={onOpenChange} />);
  return { onOpenChange };
}

describe("InstitutionModal", () => {
  it("should stay out of the way until an institution is picked", () => {
    // GIVEN no institution picked
    // WHEN the modal is rendered closed
    renderModal({ status: "idle" }, false);

    // THEN nothing is shown
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should name the institution it is showing, with where it is and who leads it", () => {
    // GIVEN an institution's drill-down
    // WHEN the modal opens
    renderModal();

    // THEN the dialog is named after the institution
    expect(screen.getByRole("dialog", { name: /Chipata Vocational Centre/ })).toBeInTheDocument();
    // AND its city, region and lead read as one line
    expect(screen.getByText("Chipata · Eastern · Lead: Isaac Chirwa")).toBeInTheDocument();
  });

  it("should show Build Your Profile completion as the header ring", () => {
    // GIVEN an institution 28% of the way through Build Your Profile
    // WHEN the modal opens
    renderModal();

    // THEN the ring reports that progress
    expect(screen.getByRole("progressbar", { name: "28% complete" })).toHaveAttribute("aria-valuenow", "28");
    expect(screen.getByText("Profile score")).toBeInTheDocument();
  });

  it("should summarise who the institution reached", () => {
    // GIVEN an institution's drill-down
    // WHEN the modal opens
    renderModal();

    // THEN the reach panel reads its audience
    const reach = within(screen.getByTestId(DATA_TEST_ID.REACH));
    expect(reach.getByText("4,339")).toBeInTheDocument();
    expect(reach.getByText("1,810")).toBeInTheDocument();
    expect(reach.getByText("18–24")).toBeInTheDocument();
    expect(reach.getByText("Women")).toBeInTheDocument();
    expect(reach.getByText("Secondary")).toBeInTheDocument();
  });

  it("should summarise how its jobseekers log in", () => {
    // GIVEN an institution's drill-down
    // WHEN the modal opens
    renderModal();

    // THEN the login panel reads the activity, with the session length in minutes
    const login = within(screen.getByTestId(DATA_TEST_ID.LOGIN_ACTIVITY));
    expect(login.getByText("3.4")).toBeInTheDocument();
    expect(login.getByText("8,733")).toBeInTheDocument();
    expect(login.getByText("8 min")).toBeInTheDocument();
    expect(login.getByText("58%")).toBeInTheDocument();
    expect(login.getByText("42%")).toBeInTheDocument();
  });

  it("should show how far jobseekers get in each deployed module, in its own words", () => {
    // GIVEN an institution running all four modules
    // WHEN the modal opens
    renderModal();

    // THEN each module reports how many started it
    const progress = within(screen.getByTestId(DATA_TEST_ID.PROGRESS));
    expect(progress.getAllByTestId(MODULE_TEST_ID.ROW)).toHaveLength(4);
    expect(progress.getByText("52% started")).toBeInTheDocument();
    // AND each caption is worded for that module rather than a shared phrase
    expect(progress.getByText("634 skills reports")).toBeInTheDocument();
    expect(progress.getByText("973 explored careers")).toBeInTheDocument();
    expect(progress.getByText("1,290 with a match")).toBeInTheDocument();
  });

  it("should break Job readiness down into its steps", () => {
    // GIVEN an institution whose Job readiness module has steps
    // WHEN the modal opens
    renderModal();

    // THEN the steps are listed under that module, and no other
    const jobReadinessRow = screen
      .getAllByTestId(MODULE_TEST_ID.ROW)
      .find((row) => row.dataset.module === MODULE_IDS.JOB_READINESS);
    const steps = within(jobReadinessRow as HTMLElement).getAllByTestId(MODULE_TEST_ID.SUB_MODULE);
    expect(steps).toHaveLength(2);
    expect(within(steps[0]).getByText("CV Builder")).toBeInTheDocument();
    expect(within(steps[0]).getByText("1,618 started · 47% completed")).toBeInTheDocument();
    expect(screen.getAllByTestId(MODULE_TEST_ID.SUB_MODULE)).toHaveLength(2);
  });

  it("should show the Build Your Profile outputs and how long it takes to complete", () => {
    // GIVEN an institution running Build Your Profile
    // WHEN the modal opens
    renderModal();

    // THEN its outputs are listed
    const outputs = within(screen.getByTestId(DATA_TEST_ID.OUTPUTS));
    expect(outputs.getByText("634")).toBeInTheDocument();
    expect(outputs.getByText("394")).toBeInTheDocument();
    expect(outputs.getByText("19,500")).toBeInTheDocument();
    // AND the completion time is set against its target
    const time = within(screen.getByTestId(DATA_TEST_ID.TIME_TO_COMPLETE));
    expect(time.getByText("12.3")).toBeInTheDocument();
    expect(time.getByText(/15-minute target/)).toBeInTheDocument();
  });

  it("should drop the Build Your Profile panels where that module is not deployed", () => {
    // GIVEN an institution with no Build Your Profile figures
    const givenDetailWithoutByp: InstitutionDetail = {
      ...GIVEN_DETAIL,
      profile_score_pct: undefined,
      outputs: undefined,
      modules: GIVEN_DETAIL.modules.filter((module) => module.module_id !== MODULE_IDS.BUILD_YOUR_PROFILE),
    };

    // WHEN the modal opens
    renderModal({ status: "success", data: givenDetailWithoutByp });

    // THEN the panels that only make sense for Build Your Profile are absent
    expect(screen.queryByTestId(DATA_TEST_ID.OUTPUTS)).not.toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.TIME_TO_COMPLETE)).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    // AND the remaining modules still report their progress
    expect(screen.getAllByTestId(MODULE_TEST_ID.ROW)).toHaveLength(3);
  });

  it("should say it is loading while the drill-down is on its way", () => {
    // GIVEN a drill-down that has not arrived yet
    // WHEN the modal opens
    renderModal({ status: "loading" });

    // THEN it says so, inside a dialog that a screen reader can still name
    expect(screen.getByTestId(DATA_TEST_ID.LOADING)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Institution detail" })).toBeInTheDocument();
  });

  it("should explain a drill-down that could not be loaded, and offer to try again", async () => {
    // GIVEN a drill-down that failed
    const givenRetry = vi.fn();

    // WHEN the modal opens
    renderModal({ status: "error", retry: givenRetry });

    // THEN the failure is explained
    expect(screen.getByTestId(DATA_TEST_ID.ERROR)).toHaveTextContent("Failed to load this institution.");

    // WHEN the retry is taken
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    // THEN the same institution is fetched again
    expect(givenRetry).toHaveBeenCalled();
  });

  it("should take focus into the dialog on open, without lighting up the close control", () => {
    // GIVEN an institution's drill-down
    // WHEN the modal opens
    renderModal();

    // THEN focus lands on the dialog itself, so nothing opens looking pressed
    expect(screen.getByRole("dialog")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Close" })).not.toHaveFocus();
  });

  it("should scroll its body rather than the dialog, keeping the close control inside it", () => {
    // GIVEN a drill-down taller than the dialog
    // WHEN it opens
    renderModal();

    // THEN the body is the part that scrolls
    const body = screen.getByTestId(DATA_TEST_ID.BODY);
    expect(body.className).toContain("overflow-y-auto");
    // AND the close control scrolls with it, so the region is reachable by keyboard without a tabIndex
    expect(body).toContainElement(screen.getByRole("button", { name: "Close" }));
    expect(body).not.toHaveAttribute("tabindex");
  });

  it("should close when the user dismisses it", async () => {
    // GIVEN an open drill-down
    const { onOpenChange } = renderModal();

    // WHEN the close control is used
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    // THEN the screen is told to close it
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
