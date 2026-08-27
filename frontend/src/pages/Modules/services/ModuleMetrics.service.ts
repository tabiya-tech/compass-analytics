import { MODULE_IDS, type ModuleId } from "@/access/AccessContext";
import { serializeInstitutions } from "@/analytics/analytics.utils";
import { AnalyticsService } from "@/analytics/Analytics.service";
import { deriveGranularity } from "@/filters/filters";
import {
  mapBuildYourProfileResponse,
  mapJobReadinessResponse,
  unavailableBuildYourProfile,
  unavailableCareerExplorer,
  unavailableJobReadiness,
  unavailableJobs,
} from "@/pages/Modules/services/ModuleMetrics.adapter";
import type { ModuleMetrics, ModuleMetricsRequest, ModuleMetricsResponse } from "@/pages/Modules/types";
import type { RequestedInstitutions } from "@/pages/Overview/overview.types";

export const MODULES_API_BASE = "/api/modules";

export class ModuleMetricsApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ModuleMetricsApiError";
    this.status = status;
  }
}

function toInstitutionId(institutions: RequestedInstitutions): string | undefined {
  if (institutions === "all") return undefined;
  if (institutions.length === 1) return institutions[0];
  return undefined;
}

async function fetchModuleMetrics(
  moduleId: ModuleId,
  request: ModuleMetricsRequest,
  token: string,
  options?: { signal?: AbortSignal }
): Promise<ModuleMetrics> {
  const analyticsParams = {
    start_date: request.dateRange.start,
    end_date: request.dateRange.end,
    granularity: deriveGranularity(request.dateRange),
    audience_segment: request.audienceSegment ?? undefined,
    login_method: request.loginMethod ?? undefined,
    institution_id: toInstitutionId(request.institutions),
  };

  try {
    switch (moduleId) {
      case MODULE_IDS.BUILD_YOUR_PROFILE: {
        const response = await AnalyticsService.getInstance().getBuildYourProfile(analyticsParams, token, options);
        return mapBuildYourProfileResponse(response);
      }
      case MODULE_IDS.JOB_READINESS: {
        const response = await AnalyticsService.getInstance().getJobReadiness(analyticsParams, token, options);
        return mapJobReadinessResponse(response);
      }
      default:
        // No backend endpoint for this module yet — return a degraded stub rather than failing the page.
        return unavailableForModule(moduleId);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    return unavailableForModule(moduleId);
  }
}

function unavailableForModule(moduleId: ModuleId): ModuleMetrics {
  switch (moduleId) {
    case MODULE_IDS.BUILD_YOUR_PROFILE:
      return unavailableBuildYourProfile();
    case MODULE_IDS.JOB_READINESS:
      return unavailableJobReadiness();
    case MODULE_IDS.CAREER_EXPLORER:
      return unavailableCareerExplorer();
    case MODULE_IDS.JOBS:
      return unavailableJobs();
  }
}

export class ModuleMetricsService {
  private static instance: ModuleMetricsService | null = null;

  static getInstance(): ModuleMetricsService {
    ModuleMetricsService.instance ??= new ModuleMetricsService();
    return ModuleMetricsService.instance;
  }

  /** Fans out one call per active module. Modules without a backend endpoint return a degraded stub. */
  async getModuleMetrics(
    request: ModuleMetricsRequest,
    token: string,
    options?: { signal?: AbortSignal }
  ): Promise<ModuleMetricsResponse> {
    const modules = await Promise.all(
      request.modules.map((moduleId) => fetchModuleMetrics(moduleId, request, token, options))
    );

    const scope =
      request.institutions === "all"
        ? { type: "portfolio" as const, institutionCount: 0 }
        : request.institutions.length === 1
          ? { type: "institution" as const, institutionId: request.institutions[0], institutionName: "" }
          : { type: "portfolio" as const, institutionCount: request.institutions.length };

    return { scope, dateRange: request.dateRange, modules };
  }
}

/** Narrows the response to one module, for the screens that show a single module rather than all of them. */
export function findModuleMetrics(response: ModuleMetricsResponse, moduleId: ModuleId) {
  return response.modules.find((module) => module.moduleId === moduleId) ?? null;
}

/** @deprecated Use serializeInstitutions from analytics.utils instead. Kept temporarily for test compatibility. */
export function buildModuleMetricsQuery(request: ModuleMetricsRequest): URLSearchParams {
  const query = new URLSearchParams({
    institutions: serializeInstitutions(request.institutions),
    start: request.dateRange.start,
    end: request.dateRange.end,
  });
  if (request.modules.length === 0) {
    query.append("modules", "");
  } else {
    for (const moduleId of request.modules) query.append("modules", moduleId);
  }
  if (request.audienceSegment) query.set("audienceSegment", request.audienceSegment);
  if (request.loginMethod) query.set("loginMethod", request.loginMethod);
  return query;
}
