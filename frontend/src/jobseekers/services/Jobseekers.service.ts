import type { AccessScope } from "@/access/AccessContext";
import type {
  JobseekerDetail,
  JobseekersResponse,
  JobseekersSort,
  ModuleStatusFilters,
} from "@/jobseekers/jobseekers.types";

export const JOBSEEKERS_API_BASE = "/api";

export class JobseekersApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "JobseekersApiError";
    this.status = status;
  }
}

// One field per GET /api/jobseekers query parameter — no single request-body schema exists
// for this endpoint to generate a combined type from.
export interface GetJobseekersParams {
  scope: AccessScope;
  search?: string;
  moduleStatusFilters?: ModuleStatusFilters;
  sort: JobseekersSort;
  page: number;
  pageSize: number;
}

export class JobseekersService {
  private static instance: JobseekersService | null = null;

  static getInstance(): JobseekersService {
    JobseekersService.instance ??= new JobseekersService();
    return JobseekersService.instance;
  }

  // `all` asks the endpoint to resolve the grant itself; a list names the institutions outright.
  private _appendScope(url: URL, scope: AccessScope): void {
    if (scope.institutionIds === null) {
      url.searchParams.set("scope", "all");
      return;
    }
    for (const institutionId of scope.institutionIds) url.searchParams.append("institution_id", institutionId);
  }

  // One `module_status=<module>:<status>` per kept status, so any mix of modules can be filtered.
  private _appendModuleStatus(url: URL, filters: ModuleStatusFilters): void {
    for (const [moduleId, statuses] of Object.entries(filters)) {
      for (const status of statuses ?? []) url.searchParams.append("module_status", `${moduleId}:${status}`);
    }
  }

  private _buildUrl(params: GetJobseekersParams): URL {
    const url = new URL(`${JOBSEEKERS_API_BASE}/jobseekers`, window.location.origin);
    this._appendScope(url, params.scope);
    if (params.search) url.searchParams.set("search", params.search);
    this._appendModuleStatus(url, params.moduleStatusFilters ?? {});
    url.searchParams.set("sort_by", params.sort.by);
    url.searchParams.set("sort_dir", params.sort.direction);
    url.searchParams.set("page", String(params.page));
    url.searchParams.set("page_size", String(params.pageSize));
    return url;
  }

  private async _get<T>(url: string, token: string): Promise<T> {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (!response.ok) {
      throw new JobseekersApiError(response.status, `Jobseekers API error: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async getJobseekers(params: GetJobseekersParams, token: string): Promise<JobseekersResponse> {
    return this._get<JobseekersResponse>(this._buildUrl(params).toString(), token);
  }

  async getJobseeker(jobseekerId: string, token: string): Promise<JobseekerDetail> {
    const url = new URL(`${JOBSEEKERS_API_BASE}/jobseekers/${encodeURIComponent(jobseekerId)}`, window.location.origin);
    return this._get<JobseekerDetail>(url.toString(), token);
  }
}
