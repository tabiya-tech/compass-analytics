import { useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { useAuth } from "@/auth/AuthContext";
import { useFilters } from "@/filters/FiltersContext";
import { AnalyticsService } from "@/analytics/Analytics.service";
import type { ReachResponse } from "@/analytics/analytics.types";

export type ReachState =
  { status: "loading" } | { status: "error"; message: string } | { status: "success"; data: ReachResponse };

export function useReach(): ReachState {
  const { getIdToken } = useAuth();
  const { filters } = useFilters();
  const [state, setState] = useState<ReachState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    (async () => {
      try {
        const token = await getIdToken();
        const data = await AnalyticsService.getInstance().getReach(
          {
            start_date: filters.dateRange.start,
            end_date: filters.dateRange.end,
            granularity: filters.granularity,
            audience_segment: filters.audienceSegment ?? undefined,
            login_method: filters.loginMethod ?? undefined,
            institution_id: filters.institutionDrillDownId ?? undefined,
          },
          token
        );
        if (!cancelled) setState({ status: "success", data });
      } catch (error) {
        // Surface the real failure to Sentry; show the user a generic message.
        Sentry.captureException(error);
        if (!cancelled) setState({ status: "error", message: "Failed to load reach data." });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getIdToken, filters]);

  return state;
}
