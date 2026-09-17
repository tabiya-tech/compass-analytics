import type { InstitutionDetail, InstitutionsResponse } from "@/institutions/institutions.types";

export const INSTITUTIONS_API_BASE = "/api/analytics";

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

  private async _get<T>(url: string, token: string): Promise<T> {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (!response.ok) {
      throw new InstitutionsApiError(response.status, `Institutions API error: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async getInstitutions(token: string): Promise<InstitutionsResponse> {
    const url = new URL(`${INSTITUTIONS_API_BASE}/institutions`, window.location.origin);
    return this._get<InstitutionsResponse>(url.toString(), token);
  }

  async getInstitution(institutionId: string, token: string): Promise<InstitutionDetail> {
    const url = new URL(
      `${INSTITUTIONS_API_BASE}/institutions/${encodeURIComponent(institutionId)}`,
      window.location.origin
    );
    return this._get<InstitutionDetail>(url.toString(), token);
  }
}
