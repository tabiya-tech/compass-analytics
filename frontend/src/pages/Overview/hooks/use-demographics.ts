import { useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { useAuth } from "@/auth/AuthContext";
import { useFilters } from "@/filters/FiltersContext";
import { AnalyticsService } from "@/analytics/Analytics.service";
import type { DemographicsResponse } from "@/analytics/analytics.types";

export type DemographicsState =
  { status: "loading" } | { status: "error"; message: string } | { status: "success"; data: DemographicsResponse };

/** Fetches GET /api/demographics, filtered the same way useReach filters /api/reach. */
export function useDemographics(): DemographicsState {
  const { getIdToken } = useAuth();
  const { filters } = useFilters();
  const [state, setState] = useState<DemographicsState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    (async () => {
      try {
        const token = await getIdToken();
        const data = await AnalyticsService.getInstance().getDemographics(
          {
            start_date: filters.dateRange.start,
            end_date: filters.dateRange.end,
            granularity: filters.granularity,
            institution_id: filters.institutionDrillDownId ?? undefined,
          },
          token
        );
        if (!cancelled) setState({ status: "success", data });
      } catch (error) {
        // Surface the real failure to Sentry; show the user a generic message.
        Sentry.captureException(error);
        if (!cancelled) setState({ status: "error", message: "Failed to load demographics data." });
      }
    })();

    return () => {
      cancelled = true;
    };
    // Depends on the fields the request actually sends, not the whole filters object.
  }, [getIdToken, filters.dateRange.start, filters.dateRange.end, filters.granularity, filters.institutionDrillDownId]);

  return state;
}
