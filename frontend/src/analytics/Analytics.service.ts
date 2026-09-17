import type {
  AnalyticsParams,
  BuildYourProfileResponse,
  CareerExplorerResponse,
  DemographicsParams,
  DemographicsResponse,
  JobReadinessResponse,
  JobsResponse,
  ReachResponse,
} from "@/analytics/analytics.types";

export const ANALYTICS_API_BASE = "/api";

export class AnalyticsApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AnalyticsApiError";
    this.status = status;
  }
}

export class AnalyticsService {
  private static instance: AnalyticsService | null = null;

  static getInstance(): AnalyticsService {
    AnalyticsService.instance ??= new AnalyticsService();
    return AnalyticsService.instance;
  }

  private async _fetch<T>(
    path: string,
    token: string,
    params?: Record<string, string | undefined>,
    options?: { signal?: AbortSignal }
  ): Promise<T> {
    const url = new URL(`${ANALYTICS_API_BASE}${path}`, window.location.origin);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      signal: options?.signal,
    });

    if (!response.ok) {
      throw new AnalyticsApiError(response.status, `Analytics API error: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  // params' optional fields are `X | null`; normalize null to undefined so _fetch omits an
  // unset filter from the query string instead of sending the literal string "null".
  private _analyticsQueryParams(params: AnalyticsParams): Record<string, string | undefined> {
    return {
      start_date: params.start_date,
      end_date: params.end_date,
      granularity: params.granularity,
      audience_segment: params.audience_segment ?? undefined,
      login_method: params.login_method ?? undefined,
      institution_id: params.institution_id ?? undefined,
    };
  }

  private _demographicsQueryParams(params: DemographicsParams): Record<string, string | undefined> {
    return {
      start_date: params.start_date,
      end_date: params.end_date,
      granularity: params.granularity,
      institution_id: params.institution_id ?? undefined,
    };
  }

  async getReach(params: AnalyticsParams, token: string): Promise<ReachResponse> {
    return this._fetch<ReachResponse>("/reach", token, this._analyticsQueryParams(params));
  }

  async getBuildYourProfile(
    params: AnalyticsParams,
    token: string,
    options?: { signal?: AbortSignal }
  ): Promise<BuildYourProfileResponse> {
    return this._fetch<BuildYourProfileResponse>(
      "/modules/build-your-profile",
      token,
      this._analyticsQueryParams(params),
      options
    );
  }

  async getDemographics(params: DemographicsParams, token: string): Promise<DemographicsResponse> {
    return this._fetch<DemographicsResponse>("/demographics", token, this._demographicsQueryParams(params));
  }

  async getJobReadiness(
    params: AnalyticsParams,
    token: string,
    options?: { signal?: AbortSignal }
  ): Promise<JobReadinessResponse> {
    return this._fetch<JobReadinessResponse>(
      "/modules/job-readiness",
      token,
      this._analyticsQueryParams(params),
      options
    );
  }

  async getCareerExplorer(params: AnalyticsParams, token: string): Promise<CareerExplorerResponse> {
    return this._fetch<CareerExplorerResponse>("/modules/career-explorer", token, this._analyticsQueryParams(params));
  }

  async getJobs(params: AnalyticsParams, token: string): Promise<JobsResponse> {
    return this._fetch<JobsResponse>("/modules/jobs", token, this._analyticsQueryParams(params));
  }
}
