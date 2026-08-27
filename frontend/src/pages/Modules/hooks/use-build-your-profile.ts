import { useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { useAuth } from "@/auth/AuthContext";
import { useFilters } from "@/filters/FiltersContext";
import { createFixedModulesDateRange, deriveGranularity } from "@/filters/filters";
import { AnalyticsService } from "@/analytics/Analytics.service";
import type { BuildYourProfileResponse } from "@/analytics/analytics.types";
import {
  mapBuildYourProfileResponse,
  unavailableBuildYourProfile,
} from "@/pages/Modules/services/ModuleMetrics.adapter";

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

export { mapBuildYourProfileResponse as toBuildYourProfileMetrics } from "@/pages/Modules/services/ModuleMetrics.adapter";
export { unavailableBuildYourProfile as unavailableBuildYourProfileMetrics } from "@/pages/Modules/services/ModuleMetrics.adapter";

// BuildYourProfileResponse is imported above for the useBuildYourProfile return type — kept as a type alias here so
// callers that import it from this module continue to work.
export type { BuildYourProfileResponse };
