import type {
  AnalyticsParams,
  BuildYourProfileResponse,
  DemographicsParams,
  DemographicsResponse,
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

  private async _fetch<T>(path: string, token: string, params?: Record<string, string | undefined>): Promise<T> {
    const url = new URL(`${ANALYTICS_API_BASE}${path}`, window.location.origin);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new AnalyticsApiError(response.status, `Analytics API error: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async getReach(params: AnalyticsParams, token: string): Promise<ReachResponse> {
    return this._fetch<ReachResponse>("/reach", token, {
      start_date: params.start_date,
      end_date: params.end_date,
      granularity: params.granularity,
      audience_segment: params.audience_segment,
      login_method: params.login_method,
      institution_id: params.institution_id,
    });
  }

  async getBuildYourProfile(params: AnalyticsParams, token: string): Promise<BuildYourProfileResponse> {
    return this._fetch<BuildYourProfileResponse>("/modules/build-your-profile", token, {
      start_date: params.start_date,
      end_date: params.end_date,
      granularity: params.granularity,
      audience_segment: params.audience_segment,
      login_method: params.login_method,
      institution_id: params.institution_id,
    });
  }

  async getDemographics(params: DemographicsParams, token: string): Promise<DemographicsResponse> {
    return this._fetch<DemographicsResponse>("/demographics", token, {
      start_date: params.start_date,
      end_date: params.end_date,
      granularity: params.granularity,
      institution_id: params.institution_id,
    });
  }
}
