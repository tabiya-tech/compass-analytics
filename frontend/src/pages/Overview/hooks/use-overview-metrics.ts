import { useCallback, useEffect, useMemo, useState } from "react";
import * as Sentry from "@sentry/react";
import { useAuth } from "@/auth/AuthContext";
import { useAccess, type AccessScope } from "@/access/AccessContext";
import { useFilters } from "@/filters/FiltersContext";
import type { FiltersState } from "@/filters/filters";
import type { OverviewMetricsRequest, OverviewMetricsResponse } from "@/pages/Overview/overview.types";
import { OverviewMetricsService } from "@/pages/Overview/services/OverviewMetrics.service";

export interface OverviewMetricsState {
  metrics: OverviewMetricsResponse | null;
  isLoading: boolean;
  error: Error | null;
}

export interface OverviewMetricsResult extends OverviewMetricsState {
  reload: () => void; // refetches the current selection — what the error state's retry calls
}

/** A drill-down narrows the grant to one institution; without one, the whole grant is in scope. */
export function toOverviewMetricsRequest(scope: AccessScope, filters: FiltersState): OverviewMetricsRequest {
  const institutions = filters.institutionDrillDownId
    ? [filters.institutionDrillDownId]
    : scope.institutionIds === null
      ? "all"
      : scope.institutionIds;

  return {
    institutions,
    dateRange: filters.dateRange,
    granularity: filters.granularity,
    audienceSegment: filters.audienceSegment,
    loginMethod: filters.loginMethod,
  };
}

/** The Overview screen's data. Refetches on scope/filters changes, holding the previous figures while the next ones load. */
export function useOverviewMetrics(): OverviewMetricsResult {
  const { getIdToken } = useAuth();
  const { scope } = useAccess();
  const { filters } = useFilters();
  const service = OverviewMetricsService.getInstance();

  const [state, setState] = useState<OverviewMetricsState>({ metrics: null, isLoading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((previous) => previous + 1), []);

  const request = useMemo(() => toOverviewMetricsRequest(scope, filters), [scope, filters]);

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, isLoading: true }));

    (async () => {
      try {
        const token = await getIdToken();
        const metrics = await service.getOverviewMetrics(request, token, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setState({ metrics, isLoading: false, error: null });
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        Sentry.captureException(error);
        // Keeps the last good figures visible, with the error alongside them.
        setState((previous) => ({
          metrics: previous.metrics,
          isLoading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }));
      }
    })();

    return () => controller.abort();
  }, [request, service, attempt, getIdToken]);

  return { ...state, reload };
}
