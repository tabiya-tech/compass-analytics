import { MODULE_IDS, type ModuleId } from "@/access/AccessContext";
import { MODULE_ORDER } from "@/access/moduleDisplay";
import type { JobseekerSortKey } from "@/jobseekers/jobseekers.types";
import type { TranslationKey } from "@/i18n/react-i18next";

/** Module columns filter by status; the skills column neither sorts nor filters. */
export type JobseekerColumnId = JobseekerSortKey | ModuleId | "skills";

export interface JobseekerColumn {
  id: JobseekerColumnId;
  labelKey: TranslationKey;
  sortable: boolean;
  numeric: boolean;
  /** Set on the per-module status columns — the module whose status the column reports. */
  moduleId?: ModuleId;
}

const MODULE_COLUMN_LABEL_KEYS: Record<ModuleId, TranslationKey> = {
  [MODULE_IDS.BUILD_YOUR_PROFILE]: "nav.modulesSection.buildYourProfile",
  [MODULE_IDS.JOB_READINESS]: "nav.modulesSection.jobReadiness",
  [MODULE_IDS.CAREER_EXPLORER]: "nav.modulesSection.careerExplorer",
  [MODULE_IDS.JOBS]: "nav.modulesSection.jobs",
};

const FIXED_COLUMNS: readonly JobseekerColumn[] = [
  { id: "name", labelKey: "jobseekers.table.columns.name", sortable: true, numeric: false },
  { id: "profile_score_pct", labelKey: "jobseekers.table.columns.profileScore", sortable: true, numeric: true },
  { id: "registered_at", labelKey: "jobseekers.table.columns.registered", sortable: true, numeric: false },
  { id: "last_login_at", labelKey: "jobseekers.table.columns.lastLogin", sortable: true, numeric: false },
];

const SKILLS_COLUMN: JobseekerColumn = {
  id: "skills",
  labelKey: "jobseekers.table.columns.skills",
  sortable: false,
  numeric: false,
};

/**
 * One status column per deployed module, except Jobs — a job match is an outcome rather than a
 * place in a journey, so it lives in the profile drill-down instead of the roster.
 */
export function getJobseekerColumns(activeModules: readonly ModuleId[]): JobseekerColumn[] {
  // MODULE_ORDER keeps the columns in suite order however the deployment lists its modules.
  const moduleColumns: JobseekerColumn[] = MODULE_ORDER.filter(
    (moduleId) => moduleId !== MODULE_IDS.JOBS && activeModules.includes(moduleId)
  ).map((moduleId) => ({
    id: moduleId,
    labelKey: MODULE_COLUMN_LABEL_KEYS[moduleId],
    sortable: false,
    numeric: false,
    moduleId,
  }));

  return [...FIXED_COLUMNS, ...moduleColumns, SKILLS_COLUMN];
}
