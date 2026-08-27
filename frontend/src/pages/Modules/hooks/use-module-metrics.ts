import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MODULE_IDS, useAccess, type AccessScope, type ModuleId } from "@/access/AccessContext";
import { useFilters } from "@/filters/FiltersContext";
import { createFixedModulesDateRange, type FiltersState } from "@/filters/filters";
import {
  toBuildYourProfileMetrics,
  unavailableBuildYourProfileMetrics,
  useBuildYourProfile,
} from "@/pages/Modules/hooks/use-build-your-profile";
import {
  toCareerExplorerMetrics,
  unavailableCareerExplorerMetrics,
  useCareerExplorer,
} from "@/pages/Modules/hooks/use-career-explorer";
import { toJobsMetrics, unavailableJobsMetrics, useJobs } from "@/pages/Modules/hooks/use-jobs";
import type {
  BuildYourProfileMetrics,
  CareerExplorerMetrics,
  JobsMetrics,
  ModuleMetrics,
  ModuleMetricsRequest,
  ModuleMetricsResponse,
} from "@/pages/Modules/types";
import { ModuleMetricsService } from "@/pages/Modules/services/ModuleMetrics.service";

export interface ModuleMetricsState {
  metrics: ModuleMetricsResponse | null;
  isLoading: boolean;
  error: Error | null;
}

export interface ModuleMetricsResult extends ModuleMetricsState {
  reload: () => void; // refetches the current selection — what the error state's retry calls
  isModuleLoading: (moduleId: ModuleId) => boolean; // per module, so one refetch doesn't dim every tile
}

// Single source of truth for which modules have migrated off the aggregate mock.
export const MODULES_WITH_OWN_ENDPOINT: readonly ModuleId[] = [
  MODULE_IDS.BUILD_YOUR_PROFILE,
  MODULE_IDS.CAREER_EXPLORER,
  MODULE_IDS.JOBS,
];

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
  let institutions: ModuleMetricsRequest["institutions"];
  if (filters.institutionDrillDownId) {
    institutions = [filters.institutionDrillDownId];
  } else {
    institutions = scope.type === "all" ? "all" : scope.institutionIds;
  }

  return {
    institutions,
    modules: activeModules,
    // No filter on the Modules screen yet — a fixed trailing year stands in until one ships.
    dateRange: createFixedModulesDateRange(),
    audienceSegment: filters.audienceSegment,
    loginMethod: filters.loginMethod,
  };
}

type ModuleFetchState<TResponse> =
  { status: "loading" } | { status: "error"; message: string } | { status: "success"; data: TResponse };

/** Success → real figures. Error → unavailable. Loading → last real figures if any, else unavailable — never fabricated numbers. */
function resolveModuleMetrics<TResponse>(
  fetchState: ModuleFetchState<TResponse>,
  toMetrics: (data: TResponse) => ModuleMetrics,
  unavailableMetrics: () => ModuleMetrics,
  lastReal: ModuleMetrics | null
): ModuleMetrics {
  if (fetchState.status === "success") return toMetrics(fetchState.data);
  if (fetchState.status === "error") return unavailableMetrics();
  return lastReal ?? unavailableMetrics();
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

  // reloadToken lets reload() retry these fetches too, not just the one above.
  const buildYourProfileEnabled = enabled && activeModules.includes(MODULE_IDS.BUILD_YOUR_PROFILE);
  const buildYourProfile = useBuildYourProfile({ enabled: buildYourProfileEnabled, reloadToken: attempt });
  const lastRealBuildYourProfile = useRef<BuildYourProfileMetrics | null>(null);
  if (buildYourProfile.status === "success") {
    lastRealBuildYourProfile.current = toBuildYourProfileMetrics(buildYourProfile.data);
  }

  const careerExplorerEnabled = enabled && activeModules.includes(MODULE_IDS.CAREER_EXPLORER);
  const careerExplorer = useCareerExplorer({ enabled: careerExplorerEnabled, reloadToken: attempt });
  const lastRealCareerExplorer = useRef<CareerExplorerMetrics | null>(null);
  if (careerExplorer.status === "success") {
    lastRealCareerExplorer.current = toCareerExplorerMetrics(careerExplorer.data);
  }

  const jobsEnabled = enabled && activeModules.includes(MODULE_IDS.JOBS);
  const jobs = useJobs({ enabled: jobsEnabled, reloadToken: attempt });
  const lastRealJobs = useRef<JobsMetrics | null>(null);
  if (jobs.status === "success") {
    lastRealJobs.current = toJobsMetrics(jobs.data);
  }

  const metrics = useMemo<ModuleMetricsResponse | null>(() => {
    const aggregateModules = state.metrics?.modules ?? [];

    const modules = request.modules
      .map((moduleId): ModuleMetrics | null => {
        if (moduleId === MODULE_IDS.BUILD_YOUR_PROFILE && buildYourProfileEnabled) {
          return resolveModuleMetrics(
            buildYourProfile,
            toBuildYourProfileMetrics,
            unavailableBuildYourProfileMetrics,
            lastRealBuildYourProfile.current
          );
        }
        if (moduleId === MODULE_IDS.CAREER_EXPLORER && careerExplorerEnabled) {
          return resolveModuleMetrics(
            careerExplorer,
            toCareerExplorerMetrics,
            unavailableCareerExplorerMetrics,
            lastRealCareerExplorer.current
          );
        }
        if (moduleId === MODULE_IDS.JOBS && jobsEnabled) {
          return resolveModuleMetrics(jobs, toJobsMetrics, unavailableJobsMetrics, lastRealJobs.current);
        }
        return aggregateModules.find((module) => module.moduleId === moduleId) ?? null;
      })
      .filter((module): module is ModuleMetrics => module !== null);

    if (modules.length === 0) return null;
    // Key omitted, not set to undefined, when the aggregate endpoint hasn't answered yet.
    const scope = state.metrics?.scope;
    return scope ? { scope, dateRange: request.dateRange, modules } : { dateRange: request.dateRange, modules };
  }, [
    state.metrics,
    request,
    buildYourProfileEnabled,
    buildYourProfile,
    careerExplorerEnabled,
    careerExplorer,
    jobsEnabled,
    jobs,
  ]);

  // One entry per module with its own endpoint; everything else falls back to state.isLoading.
  const ownLoadingStateByModule: Partial<Record<ModuleId, boolean>> = {
    [MODULE_IDS.BUILD_YOUR_PROFILE]: buildYourProfileEnabled && buildYourProfile.status === "loading",
    [MODULE_IDS.CAREER_EXPLORER]: careerExplorerEnabled && careerExplorer.status === "loading",
    [MODULE_IDS.JOBS]: jobsEnabled && jobs.status === "loading",
  };
  const isModuleLoading = (moduleId: ModuleId): boolean => ownLoadingStateByModule[moduleId] ?? state.isLoading;

  // Only surfaced at the page level when there's truly nothing else to render.
  const error = metrics ? null : state.error;

  return { metrics, isLoading: state.isLoading, isModuleLoading, error, reload };
}
