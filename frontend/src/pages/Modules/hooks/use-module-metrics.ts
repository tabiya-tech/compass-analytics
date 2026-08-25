import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MODULE_IDS, useAccess, type AccessScope, type ModuleId } from "@/access/AccessContext";
import { useFilters } from "@/filters/FiltersContext";
import { createFixedModulesDateRange, type FiltersState } from "@/filters/filters";
import {
  toBuildYourProfileMetrics,
  unavailableBuildYourProfileMetrics,
  useBuildYourProfile,
} from "@/pages/Modules/hooks/use-build-your-profile";
import type { BuildYourProfileMetrics, ModuleMetricsRequest, ModuleMetricsResponse } from "@/pages/Modules/types";
import { ModuleMetricsService } from "@/pages/Modules/services/ModuleMetrics.service";

export interface ModuleMetricsState {
  metrics: ModuleMetricsResponse | null;
  isLoading: boolean;
  error: Error | null;
}

export interface ModuleMetricsResult extends ModuleMetricsState {
  reload: () => void; // refetches the current selection — what the error state's retry calls
  /** Build Your Profile has its own separate fetch, so its own loading can outlast the rest's. */
  buildYourProfileIsLoading: boolean;
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
    // No filter on the Modules screen yet — a fixed trailing year stands in until one ships.
    dateRange: createFixedModulesDateRange(),
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

  // reloadToken lets reload() retry this fetch too, not just the one above.
  const buildYourProfileEnabled = enabled && activeModules.includes(MODULE_IDS.BUILD_YOUR_PROFILE);
  const buildYourProfile = useBuildYourProfile({ enabled: buildYourProfileEnabled, reloadToken: attempt });

  const lastRealBuildYourProfile = useRef<BuildYourProfileMetrics | null>(null);
  if (buildYourProfile.status === "success") {
    lastRealBuildYourProfile.current = toBuildYourProfileMetrics(buildYourProfile.data);
  }

  const metrics = useMemo<ModuleMetricsResponse | null>(() => {
    if (!state.metrics) return null;
    if (!buildYourProfileEnabled) return state.metrics;

    // Loading reuses the last real figures if any, else unavailable — never another source's numbers.
    const buildYourProfileMetrics =
      buildYourProfile.status === "success"
        ? toBuildYourProfileMetrics(buildYourProfile.data)
        : buildYourProfile.status === "error"
          ? unavailableBuildYourProfileMetrics()
          : (lastRealBuildYourProfile.current ?? unavailableBuildYourProfileMetrics());

    return {
      ...state.metrics,
      modules: state.metrics.modules.map((module) =>
        module.moduleId === MODULE_IDS.BUILD_YOUR_PROFILE ? buildYourProfileMetrics : module
      ),
    };
  }, [state.metrics, buildYourProfile, buildYourProfileEnabled]);

  // `isLoading` only tracks the shared /metrics fetch; this covers Build Your Profile's own, separate one too.
  const buildYourProfileIsLoading =
    state.isLoading || (buildYourProfileEnabled && buildYourProfile.status === "loading");
  // Build Your Profile shows its own failure inline (the unavailable case above); it doesn't
  // trigger the page-level error banner other modules failing would.
  const error = state.error;

  return { metrics, isLoading: state.isLoading, buildYourProfileIsLoading, error, reload };
}
