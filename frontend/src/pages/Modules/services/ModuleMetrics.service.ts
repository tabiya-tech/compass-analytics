import type { ModuleId } from "@/access/AccessContext";
import { serializeInstitutions } from "@/pages/Overview/services/OverviewMetrics.service";
import type { ModuleMetricsRequest, ModuleMetricsResponse } from "@/pages/Modules/types";

export const MODULES_API_BASE = "/api/modules";

export class ModuleMetricsApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ModuleMetricsApiError";
    this.status = status;
  }
}

/** One `modules` param per module, so the order the caller asked for survives the round trip. */
export function buildModuleMetricsQuery(request: ModuleMetricsRequest): URLSearchParams {
  const query = new URLSearchParams({
    institutions: serializeInstitutions(request.institutions),
    start: request.dateRange.start,
    end: request.dateRange.end,
  });
  if (request.modules.length === 0) {
    // Explicitly mark zero modules: omitted param = all modules (default), empty param = none.
    query.append("modules", "");
  } else {
    for (const moduleId of request.modules) query.append("modules", moduleId);
  }
  if (request.audienceSegment) query.set("audienceSegment", request.audienceSegment);
  if (request.loginMethod) query.set("loginMethod", request.loginMethod);
  return query;
}

export class ModuleMetricsService {
  private static instance: ModuleMetricsService | null = null;

  static getInstance(): ModuleMetricsService {
    ModuleMetricsService.instance ??= new ModuleMetricsService();
    return ModuleMetricsService.instance;
  }

  /** Every deployed module in one round trip — the timeline compares them, so they must cover the same window. */
  async getModuleMetrics(
    request: ModuleMetricsRequest,
    options?: { signal?: AbortSignal }
  ): Promise<ModuleMetricsResponse> {
    const query = buildModuleMetricsQuery(request);
    const response = await fetch(`${MODULES_API_BASE}/metrics?${query.toString()}`, {
      headers: { Accept: "application/json" },
      signal: options?.signal,
    });

    if (!response.ok) {
      throw new ModuleMetricsApiError(response.status, `Failed to fetch module metrics (${response.status}).`);
    }

    return (await response.json()) as ModuleMetricsResponse;
  }
}

/** Narrows the response to one module, for the screens that show a single module rather than all of them. */
export function findModuleMetrics(response: ModuleMetricsResponse, moduleId: ModuleId) {
  return response.modules.find((module) => module.moduleId === moduleId) ?? null;
}
