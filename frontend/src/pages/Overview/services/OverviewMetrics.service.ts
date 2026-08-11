import type {
  OverviewMetricsRequest,
  OverviewMetricsResponse,
  RequestedInstitutions,
} from "@/pages/Overview/overview.types";

export const OVERVIEW_API_BASE = "/api/overview";

export class OverviewMetricsApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "OverviewMetricsApiError";
    this.status = status;
  }
}

/** `all`, or a comma-separated list of ids — one param either way. */
export function serializeInstitutions(institutions: RequestedInstitutions): string {
  return institutions === "all" ? "all" : institutions.join(",");
}

/** `?institutions=&start=&end=&granularity=` plus a param per applied filter. */
export function buildOverviewMetricsQuery(request: OverviewMetricsRequest): URLSearchParams {
  const query = new URLSearchParams({
    institutions: serializeInstitutions(request.institutions),
    start: request.dateRange.start,
    end: request.dateRange.end,
    granularity: request.granularity,
  });
  // Omitted rather than sent empty: an absent param means "not filtered".
  if (request.audienceSegment) query.set("audienceSegment", request.audienceSegment);
  if (request.loginMethod) query.set("loginMethod", request.loginMethod);
  return query;
}

export class OverviewMetricsService {
  private static instance: OverviewMetricsService | null = null;

  static getInstance(): OverviewMetricsService {
    OverviewMetricsService.instance ??= new OverviewMetricsService();
    return OverviewMetricsService.instance;
  }

  /** Every figure the Overview screen shows, in one round trip, so the tiles and panels can't disagree. */
  async getOverviewMetrics(
    request: OverviewMetricsRequest,
    options?: { signal?: AbortSignal }
  ): Promise<OverviewMetricsResponse> {
    const query = buildOverviewMetricsQuery(request);
    const response = await fetch(`${OVERVIEW_API_BASE}/metrics?${query.toString()}`, {
      headers: { Accept: "application/json" },
      signal: options?.signal,
    });

    if (!response.ok) {
      throw new OverviewMetricsApiError(response.status, `Failed to fetch overview metrics (${response.status}).`);
    }

    return (await response.json()) as OverviewMetricsResponse;
  }
}
