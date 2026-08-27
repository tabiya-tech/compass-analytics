import { useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { MODULE_IDS } from "@/access/AccessContext";
import { useAuth } from "@/auth/AuthContext";
import { useFilters } from "@/filters/FiltersContext";
import { createFixedModulesDateRange, deriveGranularity } from "@/filters/filters";
import { AnalyticsService } from "@/analytics/Analytics.service";
import type { JobsResponse } from "@/analytics/analytics.types";
import type { JobsMetrics } from "@/pages/Modules/types";

export type JobsState =
  { status: "loading" } | { status: "error"; message: string } | { status: "success"; data: JobsResponse };

export interface UseJobsOptions {
  enabled?: boolean;
  reloadToken?: number;
}

export function useJobs({ enabled = true, reloadToken = 0 }: UseJobsOptions = {}): JobsState {
  const { getIdToken } = useAuth();
  const { filters } = useFilters();
  const [state, setState] = useState<JobsState>({ status: "loading" });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ status: "loading" });

    (async () => {
      try {
        const token = await getIdToken();
        // No filter on the Modules screen yet — a fixed trailing year stands in until one ships.
        const dateRange = createFixedModulesDateRange();
        const data = await AnalyticsService.getInstance().getJobs(
          {
            start_date: dateRange.start,
            end_date: dateRange.end,
            granularity: deriveGranularity(dateRange),
            institution_id: filters.institutionDrillDownId ?? undefined,
          },
          token
        );
        if (!cancelled) setState({ status: "success", data });
      } catch (error) {
        Sentry.captureException(error);
        if (!cancelled) setState({ status: "error", message: "Failed to load Jobs data." });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getIdToken, filters.institutionDrillDownId, enabled, reloadToken]);

  return state;
}

export function toJobsMetrics(response: JobsResponse): JobsMetrics {
  const { summary } = response;
  return {
    moduleId: MODULE_IDS.JOBS,
    startedPercentage: 0,
    jobsSourced: summary.jobs_sourced,
    profilesWithMatches: summary.profiles_with_matches,
    profilesWithMatchesSharePercentage: Math.round(summary.profiles_with_matches_percentage),
    jobsViewedPerUser: summary.jobs_viewed_per_user,
    topCategories: [],
    degraded: response.degraded,
  };
}

/** Zeroed and degraded, same as a backend failure — used when the fetch itself throws. */
export function unavailableJobsMetrics(): JobsMetrics {
  return toJobsMetrics({
    summary: {
      jobs_sourced: 0,
      profiles_with_matches: 0,
      profiles_with_matches_percentage: 0,
      jobs_viewed_per_user: 0,
    },
    degraded: true,
  });
}
