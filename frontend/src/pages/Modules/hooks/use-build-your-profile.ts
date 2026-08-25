import { useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { MODULE_IDS } from "@/access/AccessContext";
import { useAuth } from "@/auth/AuthContext";
import { percentageOf } from "@/components/charts/chart-scale";
import { useFilters } from "@/filters/FiltersContext";
import { createFixedModulesDateRange, deriveGranularity } from "@/filters/filters";
import { AnalyticsService } from "@/analytics/Analytics.service";
import type { BuildYourProfileResponse } from "@/analytics/analytics.types";
import {
  BUILD_YOUR_PROFILE_TARGET_MINUTES,
  type BuildYourProfileMetrics,
  type ConversationPhaseId,
} from "@/pages/Modules/types";

export type BuildYourProfileState =
  { status: "loading" } | { status: "error"; message: string } | { status: "success"; data: BuildYourProfileResponse };

export interface UseBuildYourProfileOptions {
  /** Off when the caller won't render this — a disabled hook is simply left at its initial state. */
  enabled?: boolean;
  /** Bump this (e.g. from a `reload()` callback) to force a refetch without changing filters. */
  reloadToken?: number;
}

/** Fetches GET /api/modules/build-your-profile, filtered the same way useReach filters /api/reach. */
export function useBuildYourProfile({
  enabled = true,
  reloadToken = 0,
}: UseBuildYourProfileOptions = {}): BuildYourProfileState {
  const { getIdToken } = useAuth();
  const { filters } = useFilters();
  const [state, setState] = useState<BuildYourProfileState>({ status: "loading" });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ status: "loading" });

    (async () => {
      try {
        const token = await getIdToken();
        // No filter on the Modules screen yet — a fixed trailing year stands in until one ships.
        const dateRange = createFixedModulesDateRange();
        const data = await AnalyticsService.getInstance().getBuildYourProfile(
          {
            start_date: dateRange.start,
            end_date: dateRange.end,
            granularity: deriveGranularity(dateRange),
            audience_segment: filters.audienceSegment ?? undefined,
            login_method: filters.loginMethod ?? undefined,
            institution_id: filters.institutionDrillDownId ?? undefined,
          },
          token
        );
        if (!cancelled) setState({ status: "success", data });
      } catch (error) {
        Sentry.captureException(error);
        if (!cancelled) setState({ status: "error", message: "Failed to load Build Your Profile data." });
      }
    })();

    return () => {
      cancelled = true;
    };
    // dateRange/granularity aren't in this list: the fixed range above doesn't depend on filters.
  }, [getIdToken, filters.audienceSegment, filters.loginMethod, filters.institutionDrillDownId, enabled, reloadToken]);

  return state;
}

export function toBuildYourProfileMetrics(response: BuildYourProfileResponse): BuildYourProfileMetrics {
  const { summary } = response;
  return {
    moduleId: MODULE_IDS.BUILD_YOUR_PROFILE,
    startedPercentage: Math.round(summary.started_percentage),
    cvsGenerated: summary.completed_users,
    cvsGeneratedSharePercentage: percentageOf(summary.completed_users, summary.started_users),
    averageMinutesToComplete: summary.avg_completion_minutes,
    targetMinutes: BUILD_YOUR_PROFILE_TARGET_MINUTES,
    phases: response.phases.map((phase) => ({ id: phase.id as ConversationPhaseId, reached: phase.reached })),
    degraded: response.degraded,
  };
}

/** Zeroed and degraded, same as a backend failure — used when the fetch itself throws. */
export function unavailableBuildYourProfileMetrics(): BuildYourProfileMetrics {
  return toBuildYourProfileMetrics({
    summary: {
      started_users: 0,
      started_percentage: 0,
      completed_users: 0,
      avg_completion_minutes: 0,
    },
    series: [],
    phases: [],
    degraded: true,
  });
}
