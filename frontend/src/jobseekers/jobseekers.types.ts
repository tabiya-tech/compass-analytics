import type { AccessScope, ModuleId } from "@/access/AccessContext";
import type { SortDirection } from "@/institutions/institutions.types";

/** Where a jobseeker stands in one module of the suite. */
export type ModuleStatus = "not_started" | "in_progress" | "completed";

export const MODULE_STATUSES: readonly ModuleStatus[] = ["not_started", "in_progress", "completed"];

export interface JobseekerSummary {
  id: string;
  name: string;
  institution_id: string;
  institution_name: string;
  profile_score_pct: number;
  /** yyyy-MM-dd, or null for a figure the deployment has never recorded. */
  registered_at: string | null;
  last_login_at: string | null;
  module_status: Partial<Record<ModuleId, ModuleStatus>>;
  /** False until Build Your Profile is completed — the skills list is empty while it is. */
  skills_report_ready: boolean;
  skills: string[];
}

/** A step within Job Readiness, e.g. "CV Builder". */
export interface JobseekerSubModuleProgress {
  id: string;
  name: string;
  status: ModuleStatus;
}

export interface JobseekerModuleProgress {
  module_id: ModuleId;
  status: ModuleStatus;
  /** Where inside Build Your Profile they stopped, e.g. "Skills". Absent for the other modules. */
  phase?: string;
  /** Job Readiness is the one module that breaks down into steps. */
  sub_modules?: JobseekerSubModuleProgress[];
}

/** Every field is optional: a jobseeker who stopped early simply has not told us these yet. */
export interface JobseekerDemographics {
  gender: string | null;
  age: number | null;
  location: string | null;
  education: string | null;
}

export type LoginMethod = "google" | "email";

export interface JobseekerLoginActivity {
  registered_at: string | null;
  last_login_at: string | null;
  total_logins: number;
  login_method: LoginMethod | null;
}

/** What Build Your Profile produced for this jobseeker, and what they did with it. */
export interface JobseekerOutputs {
  skills_report_generated: boolean;
  downloaded: boolean;
  shared: boolean;
}

export interface JobseekerDetail {
  id: string;
  name: string;
  institution_id: string;
  institution_name: string;
  profile_score_pct: number;
  demographics: JobseekerDemographics;
  login_activity: JobseekerLoginActivity;
  modules: JobseekerModuleProgress[];
  outputs: JobseekerOutputs;
  skills: string[];
}

/** Module status columns filter rather than sort — "in progress" has no natural place in an ordering. */
export type JobseekerSortKey = "name" | "profile_score_pct" | "registered_at" | "last_login_at";

export interface JobseekersSort {
  by: JobseekerSortKey;
  direction: SortDirection;
}

/** Which statuses are kept, per module. An absent or empty entry means "don't filter on this module". */
export type ModuleStatusFilters = Partial<Record<ModuleId, readonly ModuleStatus[]>>;

/**
 * Sort, filter and pagination run server-side, the way they do for institutions — a deployment
 * holds far more jobseekers than a client should pull down to sort in memory.
 *
 * `scope` is the caller's grant, sent so the endpoint can be asked for exactly what the user may
 * see. It is a hint, not the boundary: the endpoint must re-derive the grant from the bearer token
 * and reject anything wider. A client that widens it must get a 403, never institution B's roster.
 */
export interface JobseekersQuery {
  scope: AccessScope;
  search?: string;
  module_status?: ModuleStatusFilters;
  sort: JobseekersSort;
  page: number;
  page_size: number;
}

export interface JobseekersResponse {
  items: JobseekerSummary[];
  total: number;
  page: number;
  page_size: number;
}
