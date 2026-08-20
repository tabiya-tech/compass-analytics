import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccess, type AccessScope, type ModuleId } from "@/access/AccessContext";
import { useFilters } from "@/filters/FiltersContext";
import type { FiltersState } from "@/filters/filters";
import type { ModuleMetricsRequest, ModuleMetricsResponse } from "@/pages/Modules/types";
import { ModuleMetricsService } from "@/pages/Modules/services/ModuleMetrics.service";

export interface ModuleMetricsState {
  metrics: ModuleMetricsResponse | null;
  isLoading: boolean;
  error: Error | null;
}

export interface ModuleMetricsResult extends ModuleMetricsState {
  reload: () => void; // refetches the current selection — what the error state's retry calls
}

export interface UseModuleMetricsOptions {
  /** Off on a screen that may not render the figures, so it doesn't pay for a call it won't use. */
  enabled?: boolean;
}

/** A drill-down narrows the grant to one institution; without one, the whole grant is in scope. */
export function toModuleMetricsRequest(
  scope: AccessScope,
  activeModules: readonly ModuleId[],
  filters: FiltersState
): ModuleMetricsRequest {
  const institutions = filters.institutionDrillDownId
    ? [filters.institutionDrillDownId]
    : scope.type === "all"
      ? "all"
      : scope.institutionIds;

  return {
    institutions,
    modules: activeModules,
    dateRange: filters.dateRange,
    audienceSegment: filters.audienceSegment,
    loginMethod: filters.loginMethod,
  };
}

/** The deployed modules' figures. Refetches on scope/filters changes, holding the previous ones meanwhile. */
export function useModuleMetrics({ enabled = true }: UseModuleMetricsOptions = {}): ModuleMetricsResult {
  const { scope, activeModules } = useAccess();
  const { filters } = useFilters();
  const service = ModuleMetricsService.getInstance();

  const [state, setState] = useState<ModuleMetricsState>({ metrics: null, isLoading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((previous) => previous + 1), []);

  const request = useMemo(() => toModuleMetricsRequest(scope, activeModules, filters), [scope, activeModules, filters]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState((previous) => ({ ...previous, isLoading: true }));

    service
      .getModuleMetrics(request, { signal: controller.signal })
      .then((metrics) => {
        if (controller.signal.aborted) return;
        setState({ metrics, isLoading: false, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        // Keeps the last good figures visible, with the error alongside them.
        setState((previous) => ({
          metrics: previous.metrics,
          isLoading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }));
      });

    return () => controller.abort();
  }, [request, service, attempt, enabled]);

  return { ...state, reload };
}
