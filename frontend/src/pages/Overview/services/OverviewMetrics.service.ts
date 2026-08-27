import type { ReachResponse } from "@/analytics/analytics.types";
import type { OverviewMetricsRequest, OverviewMetricsResponse } from "@/pages/Overview/overview.types";
import { buildReachQuery, mapReachToOverviewMetrics } from "./OverviewMetrics.adapter";

export const REACH_API_PATH = "/api/reach";

export class OverviewMetricsApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "OverviewMetricsApiError";
    this.status = status;
  }
}

export class OverviewMetricsService {
  private static instance: OverviewMetricsService | null = null;

  static getInstance(): OverviewMetricsService {
    OverviewMetricsService.instance ??= new OverviewMetricsService();
    return OverviewMetricsService.instance;
  }

  async getOverviewMetrics(
    request: OverviewMetricsRequest,
    token: string,
    options?: { signal?: AbortSignal }
  ): Promise<OverviewMetricsResponse> {
    const query = buildReachQuery(request);
    const response = await fetch(`${REACH_API_PATH}?${query.toString()}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      signal: options?.signal,
    });

    if (!response.ok) {
      throw new OverviewMetricsApiError(response.status, `Failed to fetch overview metrics (${response.status}).`);
    }

    const reach = (await response.json()) as ReachResponse;
    return mapReachToOverviewMetrics(reach, request);
  }
}
