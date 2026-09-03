import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, waitForElementToBeRemoved, within } from "@/_test_utilities/test-utils";
import { server } from "@/mocks/server";
import { AccessProvider, MODULE_IDS, type AccessProviderProps } from "@/access/AccessContext";
import { DATA_TEST_ID as TABLE_TEST_ID } from "@/pages/JobSeekers/components/JobseekersTable";
import { DATA_TEST_ID as SKELETON_TEST_ID } from "@/pages/JobSeekers/components/JobseekersSkeleton";
import { DATA_TEST_ID, Jobseekers } from "./Jobseekers";

/** The default grant covers one institution, and that institution's cohort is 21 of the mocked 28. */
const GIVEN_JOBSEEKER_COUNT = 21;
const GIVEN_FIRST_JOBSEEKER = "Aisha Mwansa"; // the roster opens sorted by name, A–Z

function renderJobseekers(access?: AccessProviderProps) {
  return render(
    <AccessProvider {...access}>
      <Jobseekers />
    </AccessProvider>
  );
}

/** The rows arrive over the network, so every assertion waits for the first render of the table. */
async function renderAndWaitForJobseekers(access?: AccessProviderProps) {
  renderJobseekers(access);
  await waitForElementToBeRemoved(() => screen.queryByTestId(SKELETON_TEST_ID.CONTAINER));
}

function jobseekerNames(): string[] {
  return screen.getAllByTestId(TABLE_TEST_ID.NAME).map((name) => name.textContent ?? "");
}

describe("Jobseekers", () => {
  it("should show the screen heading while the roster is still being fetched", () => {
    // GIVEN an endpoint that has not yet responded
    server.use(http.get("/api/jobseekers", () => new Promise(() => {})));

    // WHEN the screen is rendered
    renderJobseekers();

    // THEN the heading is already there, with a skeleton standing in for the table
    expect(screen.getByRole("heading", { name: "Jobseekers" })).toBeInTheDocument();
    expect(screen.getByTestId(SKELETON_TEST_ID.CONTAINER)).toBeInTheDocument();
    expect(screen.getAllByTestId(SKELETON_TEST_ID.ROW).length).toBeGreaterThan(0);
  });

  it("should list the jobseekers in the granted institution, by name, and say how many there are", async () => {
    // GIVEN a grant covering one institution
    // WHEN the screen has loaded
    await renderAndWaitForJobseekers();

    // THEN one row per jobseeker in that institution is shown, A–Z
    expect(screen.getAllByTestId(TABLE_TEST_ID.ROW)).toHaveLength(GIVEN_JOBSEEKER_COUNT);
    expect(jobseekerNames()[0]).toBe(GIVEN_FIRST_JOBSEEKER);
    // AND the count reflects the cohort
    expect(screen.getByTestId(DATA_TEST_ID.COUNT)).toHaveTextContent(`${GIVEN_JOBSEEKER_COUNT} jobseekers`);
  });

  it("should never show a jobseeker from an institution the grant does not cover", async () => {
    // GIVEN a grant covering the second institution only
    const givenScope: AccessProviderProps = { scope: { institutionIds: ["inst-2"] } };

    // WHEN the screen has loaded
    await renderAndWaitForJobseekers(givenScope);

    // THEN only that institution's jobseekers are listed
    const actualNames = jobseekerNames();
    expect(actualNames).toContain("Diego Fernández");
    // AND nobody from the institution outside the grant appears
    expect(actualNames).not.toContain(GIVEN_FIRST_JOBSEEKER);
    expect(actualNames.length).toBeLessThan(GIVEN_JOBSEEKER_COUNT);
  });

  it("should list every institution's jobseekers when the grant covers the whole deployment", async () => {
    // GIVEN a deployment-wide grant
    const givenScope: AccessProviderProps = { scope: { institutionIds: null } };

    // WHEN the screen has loaded
    await renderAndWaitForJobseekers(givenScope);

    // THEN jobseekers from both institutions are listed
    const actualNames = jobseekerNames();
    expect(actualNames).toContain(GIVEN_FIRST_JOBSEEKER);
    expect(actualNames).toContain("Diego Fernández");
  });

  it("should re-order the roster when another column is sorted", async () => {
    // GIVEN the loaded roster, sorted by name
    await renderAndWaitForJobseekers();

    // WHEN the profile score column is sorted
    await userEvent.click(screen.getByRole("button", { name: "Sort by Profile score" }));

    // THEN the fullest profile leads the roster
    await waitFor(() => expect(jobseekerNames()[0]).toBe("María González"));
  });

  it("should narrow the roster to the jobseekers matching the search", async () => {
    // GIVEN the loaded roster
    await renderAndWaitForJobseekers();

    // WHEN part of a jobseeker's name is searched for
    await userEvent.type(screen.getByTestId(DATA_TEST_ID.SEARCH), "gonz");

    // THEN only that jobseeker is left
    await waitFor(() => expect(jobseekerNames()).toEqual(["María González"]));
    expect(screen.getByTestId(DATA_TEST_ID.COUNT)).toHaveTextContent("1 jobseeker");
  });

  it("should find a jobseeker by their id as well as their name", async () => {
    // GIVEN the loaded roster
    await renderAndWaitForJobseekers();

    // WHEN a jobseeker's id is searched for
    await userEvent.type(screen.getByTestId(DATA_TEST_ID.SEARCH), "JS-10230");

    // THEN that jobseeker is the only match
    await waitFor(() => expect(jobseekerNames()).toEqual(["María González"]));
  });

  it("should search on one request rather than one per keystroke", async () => {
    // GIVEN the loaded roster, with the jobseekers endpoint counting its calls
    await renderAndWaitForJobseekers();
    let calls = 0;
    const countCall = ({ request }: { request: Request }) => {
      if (new URL(request.url).pathname === "/api/jobseekers") calls += 1;
    };
    server.events.on("request:start", countCall);

    // WHEN a name is typed out
    await userEvent.type(screen.getByTestId(DATA_TEST_ID.SEARCH), "gonz");

    // THEN the roster settles on the match
    await waitFor(() => expect(jobseekerNames()).toEqual(["María González"]));
    // AND the four keystrokes cost a single request
    expect(calls).toBe(1);
    server.events.removeListener("request:start", countCall);
  });

  it("should narrow the roster to the jobseekers at the filtered stage of a module", async () => {
    // GIVEN the loaded roster
    await renderAndWaitForJobseekers();

    // WHEN Build Your Profile is filtered to the jobseekers who completed it
    await userEvent.click(screen.getByRole("button", { name: "Filter by Build Your Profile" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Completed" }));

    // THEN only they remain, and every one of them reads as completed
    await waitFor(() => expect(screen.getAllByTestId(TABLE_TEST_ID.ROW)).toHaveLength(10));
    const actualStatuses = screen
      .getAllByTestId(TABLE_TEST_ID.CELL)
      .filter((cell) => cell.dataset.column === MODULE_IDS.BUILD_YOUR_PROFILE)
      .map((cell) => cell.textContent);
    expect(new Set(actualStatuses)).toEqual(new Set(["Completed"]));
  });

  it("should explain that nothing matched, and restore the full roster once the search is cleared", async () => {
    // GIVEN the loaded roster
    await renderAndWaitForJobseekers();

    // WHEN a search matches nobody
    await userEvent.type(screen.getByTestId(DATA_TEST_ID.SEARCH), "no such jobseeker");

    // THEN the empty state explains why the table is empty
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("No jobseekers match your search or filters.")
    );

    // WHEN the search is cleared from the empty state
    await userEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));

    // THEN the whole cohort is back
    await waitFor(() => expect(screen.getAllByTestId(TABLE_TEST_ID.ROW)).toHaveLength(GIVEN_JOBSEEKER_COUNT));
  });

  it("should show a status column only for the modules the deployment runs, and never for Jobs", async () => {
    // GIVEN a deployment running Build Your Profile and Jobs
    const givenModules: AccessProviderProps = { activeModules: [MODULE_IDS.BUILD_YOUR_PROFILE, MODULE_IDS.JOBS] };

    // WHEN the screen has loaded
    await renderAndWaitForJobseekers(givenModules);

    // THEN Build Your Profile has a column
    expect(screen.getByRole("columnheader", { name: /Build Your Profile/ })).toBeInTheDocument();
    // AND Career Explorer, which is not deployed, does not
    expect(screen.queryByRole("button", { name: "Filter by Career Explorer" })).not.toBeInTheDocument();
    // AND neither does Jobs, which belongs in the profile rather than the roster
    expect(screen.queryByRole("button", { name: "Filter by Jobs" })).not.toBeInTheDocument();
  });

  it("should open the profile of the jobseeker whose row is clicked, and close it again", async () => {
    // GIVEN the loaded roster
    await renderAndWaitForJobseekers();

    // WHEN a jobseeker's name is clicked
    await userEvent.click(screen.getByRole("button", { name: /María González/ }));

    // THEN their profile opens, showing the activity trail the roster does not carry
    const dialog = await screen.findByRole("dialog", { name: /María González/ });
    expect(within(dialog).getByText("Progress across the suite")).toBeInTheDocument();
    expect(within(dialog).getByText("Login activity")).toBeInTheDocument();
    expect(within(dialog).getByText("Total logins")).toBeInTheDocument();

    // WHEN it is dismissed
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    // THEN the roster is back on its own
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("should open the skills report for a jobseeker whose report is ready", async () => {
    // GIVEN the loaded roster
    await renderAndWaitForJobseekers();

    // WHEN the skills button on a completed jobseeker's row is clicked
    const row = screen.getByRole("button", { name: /María González/ }).closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByTestId(TABLE_TEST_ID.SKILLS_BUTTON));

    // THEN their elicited skills are listed
    const dialog = await screen.findByRole("dialog", { name: /María González/ });
    expect(within(dialog).getByText("Skills Report · 3 skills elicited")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(3);
  });

  it("should say the report is not ready instead of offering skills that do not exist yet", async () => {
    // GIVEN the loaded roster
    await renderAndWaitForJobseekers();

    // WHEN a jobseeker who has not completed Build Your Profile is looked at
    const row = screen.getByRole("button", { name: /Kabelo Molefe/ }).closest("tr") as HTMLElement;

    // THEN their skills cell says so, and offers nothing to open
    expect(within(row).getByText("Report not ready")).toBeInTheDocument();
    expect(within(row).queryByTestId(TABLE_TEST_ID.SKILLS_BUTTON)).not.toBeInTheDocument();
  });

  it("should load the roster on a retry, without the user reloading the page", async () => {
    // GIVEN an endpoint that fails the first time it is called
    let calls = 0;
    server.use(
      http.get("/api/jobseekers", () => {
        calls += 1;
        return calls === 1 ? HttpResponse.error() : undefined;
      })
    );

    // AND a screen showing that failure
    renderJobseekers();
    await waitFor(() => expect(screen.getByTestId(DATA_TEST_ID.ERROR)).toBeInTheDocument());

    // WHEN the retry is taken
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    // THEN the roster arrives on the second attempt
    await waitFor(() => expect(screen.getAllByTestId(TABLE_TEST_ID.ROW)).toHaveLength(GIVEN_JOBSEEKER_COUNT));
    expect(screen.queryByTestId(DATA_TEST_ID.ERROR)).not.toBeInTheDocument();
  });

  it("should show an error message when the roster cannot be fetched", async () => {
    // GIVEN an endpoint that fails
    server.use(http.get("/api/jobseekers", () => HttpResponse.error()));

    // WHEN the screen is rendered
    renderJobseekers();

    // THEN the failure is explained and the table is not shown
    await waitFor(() => expect(screen.getByTestId(DATA_TEST_ID.ERROR)).toBeInTheDocument());
    expect(screen.queryByTestId(TABLE_TEST_ID.CONTAINER)).not.toBeInTheDocument();
  });

  describe("CSV export", () => {
    let downloadedText: string | null;

    beforeEach(() => {
      downloadedText = null;
      // jsdom has no object URLs and no real downloads, so stand in for both and keep the payload.
      URL.createObjectURL = vi.fn(async function capture(blob: Blob) {
        downloadedText = await blob.text();
        return "blob:jobseekers";
      } as unknown as typeof URL.createObjectURL);
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should export exactly the rows the table is showing, in the order it is showing them", async () => {
      // GIVEN the loaded roster, narrowed to one jobseeker
      await renderAndWaitForJobseekers();
      await userEvent.type(screen.getByTestId(DATA_TEST_ID.SEARCH), "gonz");
      await waitFor(() => expect(jobseekerNames()).toEqual(["María González"]));

      // WHEN the data is downloaded
      await userEvent.click(screen.getByTestId(DATA_TEST_ID.EXPORT));

      // THEN the file carries the headings and that one visible row, and nobody who was filtered out
      await waitFor(() => expect(downloadedText).not.toBeNull());
      const actualLines = (downloadedText as unknown as string).replace("﻿", "").split("\n");
      expect(actualLines).toHaveLength(2);
      expect(actualLines[0]).toContain("Jobseeker ID");
      expect(actualLines[1]).toContain("JS-10230");
      expect(actualLines[1]).toContain("María González");
      expect(downloadedText).not.toContain("Kabelo Molefe");
    });

    it("should carry a column for every deployed module, Jobs included", async () => {
      // GIVEN a loaded roster for a deployment running every module
      await renderAndWaitForJobseekers();

      // WHEN the data is downloaded
      await userEvent.click(screen.getByTestId(DATA_TEST_ID.EXPORT));

      // THEN the heading row names all four, even the one the table leaves to the profile
      await waitFor(() => expect(downloadedText).not.toBeNull());
      const actualHeadings = (downloadedText as unknown as string).split("\n")[0];
      expect(actualHeadings).toContain("Build Your Profile");
      expect(actualHeadings).toContain("Job readiness");
      expect(actualHeadings).toContain("Career Explorer");
      expect(actualHeadings).toContain("Jobs");
    });

    it("should offer nothing to download when no jobseeker matches", async () => {
      // GIVEN the loaded roster
      await renderAndWaitForJobseekers();

      // WHEN a search matches nobody
      await userEvent.type(screen.getByTestId(DATA_TEST_ID.SEARCH), "no such jobseeker");

      // THEN the download is disabled rather than producing an empty file
      await waitFor(() => expect(screen.getByTestId(DATA_TEST_ID.EXPORT)).toBeDisabled());
    });
  });
});
