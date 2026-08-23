import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@/_test_utilities/test-utils";
import { DATA_TEST_ID, SkillsModal } from "./SkillsModal";

const givenName = "María González";
const givenSkills = ["Customer service", "Cash handling", "Inventory management"];

describe("SkillsModal", () => {
  it("should list every skill the report elicited, under the jobseeker's name", () => {
    // GIVEN a jobseeker whose Skills Report is ready
    // WHEN their report is opened
    render(<SkillsModal open name={givenName} skills={givenSkills} onOpenChange={vi.fn()} />);

    // THEN the report is titled by their name and says how many skills it holds
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("heading", { name: givenName })).toBeInTheDocument();
    expect(dialog.getByText("Skills Report · 3 skills elicited")).toBeInTheDocument();
    // AND every skill is listed
    expect(dialog.getAllByTestId(DATA_TEST_ID.SKILL).map((skill) => skill.textContent)).toEqual(givenSkills);
  });

  it("should explain that the report is not ready rather than show an empty list", () => {
    // GIVEN a jobseeker who has not completed Build Your Profile
    // WHEN their report is opened
    render(<SkillsModal open name={givenName} skills={[]} onOpenChange={vi.fn()} />);

    // THEN the reason there are no skills is given
    expect(screen.getByTestId(DATA_TEST_ID.EMPTY)).toHaveTextContent(
      "No skills to show — the Skills Report has not been generated for this jobseeker yet."
    );
    expect(screen.queryByTestId(DATA_TEST_ID.LIST)).not.toBeInTheDocument();
  });

  it("should close when dismissed", async () => {
    // GIVEN an open report
    const onOpenChange = vi.fn();
    render(<SkillsModal open name={givenName} skills={givenSkills} onOpenChange={onOpenChange} />);

    // WHEN it is dismissed
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.CLOSE));

    // THEN the screen is told to close it
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("should show nothing while closed", () => {
    // GIVEN a closed report
    // WHEN the screen renders
    render(<SkillsModal open={false} name={givenName} skills={givenSkills} onOpenChange={vi.fn()} />);

    // THEN no dialog is on the page
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
