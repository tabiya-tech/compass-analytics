import type { ModuleId } from "@/access/AccessContext";

/** One row of the cross-institution table: an institution with its metrics already rolled up. */
export interface InstitutionSummary {
  id: string;
  name: string;
  region: string;
  registered_users: number;
  active_users: number;
  module_started_pct: Partial<Record<ModuleId, number>>;
  skills_reports?: number;
}

/** Headline figures for the whole portfolio — deliberately unaffected by search and filters. */
export interface InstitutionsTotals {
  jobseekers_reached: number;
  skills_reports: number;
  institutions: number;
}

/** A fixed column, or a module id meaning that module's "% started". */
export type InstitutionSortKey = "name" | "registered_users" | "active_users" | "skills_reports" | ModuleId;

export type SortDirection = "asc" | "desc";

export interface InstitutionsSort {
  by: InstitutionSortKey;
  direction: SortDirection;
}

/** Sort, filter and pagination run server-side: a deployment can hold more institutions than a client should sort in memory. */
export interface InstitutionsQuery {
  search?: string;
  regions?: readonly string[];
  sort: InstitutionsSort;
  page: number;
  page_size: number;
}

export interface InstitutionReach {
  registered_users: number;
  active_users_30d: number;
  top_age_band: string;
  largest_group: string;
  most_common_education: string;
}

export interface InstitutionLoginActivity {
  avg_logins_per_user: number;
  total_logins: number;
  avg_session_minutes: number;
  google_login_pct: number;
  email_login_pct: number;
}

/** A step within a module, e.g. Job Readiness' "CV Builder". */
export interface ModuleSubProgress {
  id: string;
  name: string;
  started: number;
  completed_pct: number;
}

export interface InstitutionModuleProgress {
  module_id: ModuleId;
  started_pct: number;
  highlight_value?: number;
  sub_modules?: ModuleSubProgress[];
}

/** Build Your Profile outputs — only present where BYP is deployed. */
export interface InstitutionOutputs {
  skills_reports_generated: number;
  downloaded: number;
  jobs_sourced: number;
  avg_time_to_complete_minutes: number;
  target_minutes: number;
}

export interface InstitutionDetail {
  id: string;
  name: string;
  city: string;
  region: string;
  lead_pm: string;
  profile_score_pct?: number;
  reach: InstitutionReach;
  login_activity: InstitutionLoginActivity;
  modules: InstitutionModuleProgress[];
  outputs?: InstitutionOutputs;
}

export interface InstitutionsResponse {
  items: InstitutionSummary[];
  total: number;
  page: number;
  page_size: number;
  totals: InstitutionsTotals;
  available_regions: string[];
}
