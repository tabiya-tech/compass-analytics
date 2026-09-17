import type { ModuleId } from "@/access/AccessContext";
import type { SortDirection } from "@/institutions/institutions.types";
import type { JobseekerSortKey, ModuleStatus } from "@/api-types";

export type { ModuleStatus, JobseekerSortKey };

export const MODULE_STATUSES: readonly ModuleStatus[] = ["not_started", "in_progress", "completed"];

export type {
  JobseekerSummary,
  JobseekerSubModuleProgress,
  JobseekerModuleProgress,
  JobseekerDemographics,
  JobseekerLoginActivity,
  JobseekerOutputs,
  JobseekerDetail,
  JobseekersResponse,
  JobseekerLoginMethod as LoginMethod,
} from "@/api-types";

export interface JobseekersSort {
  by: JobseekerSortKey;
  direction: SortDirection;
}

/** Which statuses are kept, per module. An absent or empty entry means "don't filter on this module". */
export type ModuleStatusFilters = Partial<Record<ModuleId, readonly ModuleStatus[]>>;
