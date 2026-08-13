import { MODULE_IDS, type ModuleId } from "@/access/AccessContext";
import { MODULE_ORDER } from "@/access/moduleDisplay";
import type { InstitutionSortKey } from "@/institutions/institutions.types";
import type { TranslationKey } from "@/i18n/react-i18next";

/** Region filters rather than sorts, so it has no sort key of its own. */
export type InstitutionColumnId = InstitutionSortKey | "region";

export interface InstitutionColumn {
  id: InstitutionColumnId;
  labelKey: TranslationKey;
  sortable: boolean;
  filterable: boolean;
  numeric: boolean;
}

// Each module gets its own label key — "started" doesn't describe a job match.
const MODULE_COLUMN_LABEL_KEYS: Record<ModuleId, TranslationKey> = {
  [MODULE_IDS.BUILD_YOUR_PROFILE]: "institutions.table.columns.buildYourProfile",
  [MODULE_IDS.JOB_READINESS]: "institutions.table.columns.jobReadiness",
  [MODULE_IDS.CAREER_EXPLORER]: "institutions.table.columns.careerExplorer",
  [MODULE_IDS.JOBS]: "institutions.table.columns.jobs",
};

const FIXED_COLUMNS: readonly InstitutionColumn[] = [
  { id: "name", labelKey: "institutions.table.columns.name", sortable: true, filterable: false, numeric: false },
  { id: "region", labelKey: "institutions.table.columns.region", sortable: false, filterable: true, numeric: false },
  {
    id: "registered_users",
    labelKey: "institutions.table.columns.registeredUsers",
    sortable: true,
    filterable: false,
    numeric: true,
  },
  {
    id: "active_users",
    labelKey: "institutions.table.columns.activeUsers",
    sortable: true,
    filterable: false,
    numeric: true,
  },
];

const SKILLS_REPORTS_COLUMN: InstitutionColumn = {
  id: "skills_reports",
  labelKey: "institutions.table.columns.skillsReports",
  sortable: true,
  filterable: false,
  numeric: true,
};

/** One "% started" column per deployed module, plus the BYP-only skills reports column. */
export function getInstitutionColumns(activeModules: readonly ModuleId[]): InstitutionColumn[] {
  // MODULE_ORDER keeps the columns in suite order however the deployment lists its modules.
  const moduleColumns: InstitutionColumn[] = MODULE_ORDER.filter((moduleId) => activeModules.includes(moduleId)).map(
    (moduleId) => ({
      id: moduleId,
      labelKey: MODULE_COLUMN_LABEL_KEYS[moduleId],
      sortable: true,
      filterable: false,
      numeric: true,
    })
  );

  const columns = [...FIXED_COLUMNS, ...moduleColumns];

  // Skills reports are a Build Your Profile output — no BYP, nothing to report.
  if (activeModules.includes(MODULE_IDS.BUILD_YOUR_PROFILE)) columns.push(SKILLS_REPORTS_COLUMN);

  return columns;
}
