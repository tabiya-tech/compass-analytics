import { render, screen, waitFor } from "@/_test_utilities/test-utils";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { FiltersProvider } from "@/filters/FiltersContext";
import { Overview, DATA_TEST_ID } from "@/pages/Overview/Overview";
import type { ReachResponse } from "@/analytics/analytics.types";
import { describe, it, expect } from "vitest";

const givenReach: ReachResponse = {
  summary: {
    total_users: 5_000,
    active_users_30d: 1_200,
    total_logins: 20_000,
    avg_logins_per_user: 4.0,
    avg_session_minutes: 18,
  },
  series: [],
};

function renderOverview() {
  return render(
    <FiltersProvider>
      <Overview />
    </FiltersProvider>
  );
}

describe("Overview", () => {
  describe("Reach summary", () => {
    it("should show the loading state while the reach data is being fetched", () => {
      // GIVEN the reach endpoint has not yet responded
      server.use(http.get("/api/analytics/reach", async () => new Promise(() => {})));

      // WHEN the overview is rendered
      renderOverview();

      // THEN the loading indicator is visible
      expect(screen.getByTestId(DATA_TEST_ID.REACH_LOADING)).toBeInTheDocument();
    });

    it("should display the reach summary cards after a successful fetch", async () => {
      // GIVEN the reach endpoint returns stub data
      server.use(http.get("/api/analytics/reach", () => HttpResponse.json(givenReach)));

      // WHEN the overview is rendered
      renderOverview();

      // THEN the reach summary cards are eventually shown
      await waitFor(() => expect(screen.getByTestId(DATA_TEST_ID.REACH_SUMMARY)).toBeInTheDocument());
      // AND the total users are displayed
      expect(screen.getByText("5,000")).toBeInTheDocument();
      // AND the active users are displayed
      expect(screen.getByText("1,200")).toBeInTheDocument();
    });

    it("should display an error message when the reach fetch fails", async () => {
      // GIVEN the reach endpoint returns a server error
      server.use(http.get("/api/analytics/reach", () => HttpResponse.error()));

      // WHEN the overview is rendered
      renderOverview();

      // THEN an error message is eventually shown
      await waitFor(() => expect(screen.getByTestId(DATA_TEST_ID.REACH_ERROR)).toBeInTheDocument());
    });
  });
});
