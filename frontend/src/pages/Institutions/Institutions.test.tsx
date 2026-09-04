import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, waitForElementToBeRemoved, within } from "@/_test_utilities/test-utils";
import { server } from "@/mocks/server";
import { AccessProvider, MODULE_IDS, type ModuleId } from "@/access/AccessContext";
import { DATA_TEST_ID as TABLE_TEST_ID } from "@/pages/Institutions/components/InstitutionsTable";
import { DATA_TEST_ID as SKELETON_TEST_ID } from "@/pages/Institutions/components/InstitutionsSkeleton";
import { DATA_TEST_ID, Institutions } from "./Institutions";

/** The mocked portfolio the shared MSW handler serves. */
const GIVEN_INSTITUTION_COUNT = 30;
const GIVEN_PAGE_SIZE = 20;

function renderInstitutions(activeModules?: ModuleId[]) {
  return render(
    <AccessProvider activeModules={activeModules}>
      <Institutions />
    </AccessProvider>
  );
}

/** The rows arrive over the network, so every assertion waits for the first render of the table. */
async function renderAndWaitForInstitutions(activeModules?: ModuleId[]) {
  renderInstitutions(activeModules);
  await waitForElementToBeRemoved(() => screen.queryByTestId(SKELETON_TEST_ID.CONTAINER));
}

function institutionNames(): string[] {
  return screen
    .getAllByTestId(TABLE_TEST_ID.CELL)
    .filter((cell) => cell.dataset.column === "name")
    .map((cell) => cell.textContent ?? "");
}

describe("Institutions", () => {
  it("should show the screen heading while the institutions are still being fetched", () => {
    // GIVEN an endpoint that has not yet responded
    server.use(http.get("/api/analytics/institutions", () => new Promise(() => {})));

    // WHEN the screen is rendered
    renderInstitutions();

    // THEN the heading is already there, with a skeleton standing in for the table
    expect(screen.getByRole("heading", { name: "How do institutions compare?" })).toBeInTheDocument();
    expect(screen.getByTestId(SKELETON_TEST_ID.CONTAINER)).toBeInTheDocument();
    expect(screen.getAllByTestId(SKELETON_TEST_ID.ROW).length).toBeGreaterThan(0);
  });

  it("should show the portfolio's headline figures above the table", async () => {
    // GIVEN the portfolio of institutions
    // WHEN the screen has loaded
    await renderAndWaitForInstitutions();

    // THEN the three headline tiles summarise the whole portfolio
    const stats = within(screen.getByTestId(DATA_TEST_ID.STATS));
    expect(stats.getByText("Jobseekers reached across the portfolio")).toBeInTheDocument();
    expect(stats.getByText("Skills Reports / CVs generated")).toBeInTheDocument();
    expect(stats.getByText(String(GIVEN_INSTITUTION_COUNT))).toBeInTheDocument();
    expect(stats.getByText("Implementing institutions")).toBeInTheDocument();
  });

  it("should list the first page of institutions, most registered users first, and say how many there are", async () => {
    // GIVEN the portfolio of institutions
    // WHEN the screen has loaded
    await renderAndWaitForInstitutions();

    // THEN a page of institutions is shown, biggest deployment first
    expect(screen.getAllByTestId(TABLE_TEST_ID.ROW)).toHaveLength(GIVEN_PAGE_SIZE);
    expect(institutionNames()[0]).toBe("Mazabuka Livelihoods Trust");
    // AND the count reflects the whole portfolio, not just the page
    expect(screen.getByTestId(DATA_TEST_ID.COUNT)).toHaveTextContent(`${GIVEN_INSTITUTION_COUNT} institutions`);
  });

  it("should re-order the table when another column is sorted", async () => {
    // GIVEN the loaded portfolio, sorted by registered users
    await renderAndWaitForInstitutions();

    // WHEN the active users column is sorted
    await userEvent.click(screen.getByRole("button", { name: "Sort by Active users" }));

    // THEN the institution with the most active users leads the table
    await waitFor(() => expect(institutionNames()[0]).toBe("Chipata Vocational Centre"));
  });

  it("should narrow the table to the institutions matching the search", async () => {
    // GIVEN the loaded portfolio
    await renderAndWaitForInstitutions();

    // WHEN part of an institution's name is searched for
    await userEvent.type(screen.getByTestId(DATA_TEST_ID.SEARCH), "mazabuka");

    // THEN only that institution is left
    await waitFor(() => expect(institutionNames()).toEqual(["Mazabuka Livelihoods Trust"]));
    expect(screen.getByTestId(DATA_TEST_ID.COUNT)).toHaveTextContent("1 institution");
  });

  it("should search on one request rather than one per keystroke", async () => {
    // GIVEN the loaded portfolio, with the institutions endpoint counting its calls
    await renderAndWaitForInstitutions();
    let calls = 0;
    const countCall = ({ request }: { request: Request }) => {
      if (new URL(request.url).pathname === "/api/analytics/institutions") calls += 1;
    };
    server.events.on("request:start", countCall);

    // WHEN a name is typed out
    await userEvent.type(screen.getByTestId(DATA_TEST_ID.SEARCH), "mazabuka");

    // THEN the table settles on the match
    await waitFor(() => expect(institutionNames()).toEqual(["Mazabuka Livelihoods Trust"]));
    // AND the eight keystrokes cost a single request
    expect(calls).toBe(1);
    server.events.removeListener("request:start", countCall);
  });

  it("should narrow the table to the institutions in the filtered regions", async () => {
    // GIVEN the loaded portfolio
    await renderAndWaitForInstitutions();

    // WHEN Luapula is picked in the region filter
    await userEvent.click(screen.getByRole("button", { name: "Filter by Region" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Luapula" }));

    // THEN only the institutions in that region remain
    await waitFor(() => expect(institutionNames()).toEqual(["Mansa Livelihoods Trust", "Samfya Vocational Centre"]));
  });

  it("should explain that nothing matched, and restore the full list once the search is cleared", async () => {
    // GIVEN the loaded portfolio
    await renderAndWaitForInstitutions();

    // WHEN a search matches no institution
    await userEvent.type(screen.getByTestId(DATA_TEST_ID.SEARCH), "no such institution");

    // THEN the empty state explains why the table is empty
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("No institutions match your search or filters.")
    );

    // WHEN the search is cleared from the empty state
    await userEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));

    // THEN the whole portfolio is back
    await waitFor(() => expect(screen.getAllByTestId(TABLE_TEST_ID.ROW)).toHaveLength(GIVEN_PAGE_SIZE));
  });

  it("should show a column only for the modules the deployment runs", async () => {
    // GIVEN a deployment running Career Explorer only
    // WHEN the screen has loaded
    await renderAndWaitForInstitutions([MODULE_IDS.CAREER_EXPLORER]);

    // THEN only that module has a column
    expect(screen.getByRole("columnheader", { name: /Career Explorer % started/ })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /BYP % started/ })).not.toBeInTheDocument();
    // AND skills reports, a Build Your Profile output, has no column either
    expect(screen.queryByRole("columnheader", { name: /Skills reports/ })).not.toBeInTheDocument();
  });

  it("should open the drill-down for the institution whose row is clicked, and close it again", async () => {
    // GIVEN the loaded portfolio
    await renderAndWaitForInstitutions();

    // WHEN an institution's row is clicked
    await userEvent.click(screen.getByRole("button", { name: "Chipata Vocational Centre" }));

    // THEN its drill-down opens, showing figures the table doesn't carry
    const dialog = await screen.findByRole("dialog", { name: /Chipata Vocational Centre/ });
    expect(within(dialog).getByText(/Chipata · Eastern · Lead:/)).toBeInTheDocument();
    expect(within(dialog).getByText("Progress across the suite")).toBeInTheDocument();

    // WHEN it is dismissed
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    // THEN the table is back on its own
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("should load the institutions on a retry, without the user reloading the page", async () => {
    // GIVEN an endpoint that fails the first time it is called
    let calls = 0;
    server.use(
      http.get("/api/analytics/institutions", () => {
        calls += 1;
        return calls === 1 ? HttpResponse.error() : undefined;
      })
    );

    // AND a screen showing that failure
    renderInstitutions();
    await waitFor(() => expect(screen.getByTestId(DATA_TEST_ID.ERROR)).toBeInTheDocument());

    // WHEN the retry is taken
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    // THEN the institutions arrive on the second attempt
    await waitFor(() => expect(screen.getAllByTestId(TABLE_TEST_ID.ROW)).toHaveLength(GIVEN_PAGE_SIZE));
    expect(screen.queryByTestId(DATA_TEST_ID.ERROR)).not.toBeInTheDocument();
  });

  it("should show an error message when the institutions cannot be fetched", async () => {
    // GIVEN an endpoint that fails
    server.use(http.get("/api/analytics/institutions", () => HttpResponse.error()));

    // WHEN the screen is rendered
    renderInstitutions();

    // THEN the failure is explained and the table is not shown
    await waitFor(() => expect(screen.getByTestId(DATA_TEST_ID.ERROR)).toBeInTheDocument());
    expect(screen.queryByTestId(TABLE_TEST_ID.CONTAINER)).not.toBeInTheDocument();
  });
});
