import type { ModuleId } from "@/access/AccessContext";
import type {
  InstitutionModuleProgress as GeneratedInstitutionModuleProgress,
  InstitutionReach,
  InstitutionLoginActivity,
} from "@/api-types";

export type {
  InstitutionSummary,
  InstitutionsTotals,
  InstitutionReach,
  InstitutionLoginActivity,
  InstitutionsResponse,
} from "@/api-types";

// A step within a module, e.g. Job Readiness' "CV Builder" — not in the OpenAPI spec yet.
export interface ModuleSubProgress {
  id: string;
  name: string;
  started: number;
  completed_pct: number;
}

// The backend's field is a plain `str`, but its only caller populates it from a hardcoded,
// closed set of module ids, so narrowing to ModuleId here is safe.
type TrustedModuleId = ModuleId;

export interface InstitutionModuleProgress extends Omit<GeneratedInstitutionModuleProgress, "module_id"> {
  module_id: TrustedModuleId;
  sub_modules?: ModuleSubProgress[]; // not in the OpenAPI spec yet
}

// Not in the OpenAPI spec: the backend hardcodes this to null (unimplemented), so this type
// describes what the UI will show once the backend sends it, not what it sends today.
export interface InstitutionOutputs {
  skills_reports_generated: number;
  downloaded: number;
  jobs_sourced: number;
  avg_time_to_complete_minutes: number;
  target_minutes: number;
}

// A fixed column, or a module id meaning that module's "% started".
export type InstitutionSortKey = "name" | "registered_users" | "active_users" | "skills_reports" | ModuleId;

export type SortDirection = "asc" | "desc";

export interface InstitutionsSort {
  by: InstitutionSortKey;
  direction: SortDirection;
}

export interface InstitutionDetail {
  id: string;
  name: string;
  city?: string;
  region?: string;
  lead_pm?: string;
  profile_score_pct?: number;
  reach: InstitutionReach;
  login_activity: InstitutionLoginActivity;
  modules: InstitutionModuleProgress[];
  outputs?: InstitutionOutputs;
}
