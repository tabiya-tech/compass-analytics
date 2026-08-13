import type { InstitutionDetail, InstitutionsQuery, InstitutionsResponse } from "@/institutions/institutions.types";

export const INSTITUTIONS_API_BASE = "/api";

export class InstitutionsApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "InstitutionsApiError";
    this.status = status;
  }
}

export class InstitutionsService {
  private static instance: InstitutionsService | null = null;

  static getInstance(): InstitutionsService {
    InstitutionsService.instance ??= new InstitutionsService();
    return InstitutionsService.instance;
  }

  /** Regions repeat as `region=a&region=b`, so the endpoint can take any number of them. */
  private _buildUrl(query: InstitutionsQuery): URL {
    const url = new URL(`${INSTITUTIONS_API_BASE}/institutions`, window.location.origin);
    if (query.search) url.searchParams.set("search", query.search);
    for (const region of query.regions ?? []) url.searchParams.append("region", region);
    url.searchParams.set("sort_by", query.sort.by);
    url.searchParams.set("sort_dir", query.sort.direction);
    url.searchParams.set("page", String(query.page));
    url.searchParams.set("page_size", String(query.page_size));
    return url;
  }

  private async _get<T>(url: string, token: string): Promise<T> {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (!response.ok) {
      throw new InstitutionsApiError(response.status, `Institutions API error: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async getInstitutions(query: InstitutionsQuery, token: string): Promise<InstitutionsResponse> {
    return this._get<InstitutionsResponse>(this._buildUrl(query).toString(), token);
  }

  async getInstitution(institutionId: string, token: string): Promise<InstitutionDetail> {
    const url = new URL(
      `${INSTITUTIONS_API_BASE}/institutions/${encodeURIComponent(institutionId)}`,
      window.location.origin
    );
    return this._get<InstitutionDetail>(url.toString(), token);
  }
}
