import { useTranslation } from "react-i18next";
import { MODULE_IDS, type ModuleId } from "@/access/AccessContext";
import { MODULE_ICONS, MODULE_LABEL_KEYS } from "@/access/moduleDisplay";
import type { InstitutionModuleProgress } from "@/institutions/institutions.types";
import type { TranslationKey } from "@/i18n/react-i18next";

const uniqueId = "b4e77a10-3c62-4f8d-9a55-2d0f6c1b8e34";

export const DATA_TEST_ID = {
  CONTAINER: `module-progress-container-${uniqueId}`,
  ROW: `module-progress-row-${uniqueId}`,
  SUB_MODULE: `module-progress-sub-module-${uniqueId}`,
};

// "Started" doesn't describe every module's outcome, so each gets its own caption copy.
const MODULE_CAPTION_KEYS: Record<ModuleId, TranslationKey> = {
  [MODULE_IDS.BUILD_YOUR_PROFILE]: "institutions.modal.progress.captions.buildYourProfile",
  [MODULE_IDS.JOB_READINESS]: "institutions.modal.progress.captions.jobReadiness",
  [MODULE_IDS.CAREER_EXPLORER]: "institutions.modal.progress.captions.careerExplorer",
  [MODULE_IDS.JOBS]: "institutions.modal.progress.captions.jobs",
};

export interface ModuleProgressProps {
  modules: readonly InstitutionModuleProgress[];
}

export function ModuleProgress({ modules }: Readonly<ModuleProgressProps>) {
  const { t } = useTranslation();

  return (
    <ul data-testid={DATA_TEST_ID.CONTAINER} className="grid gap-3">
      {modules.map((module) => {
        const Icon = MODULE_ICONS[module.module_id];

        return (
          <li
            key={module.module_id}
            data-testid={DATA_TEST_ID.ROW}
            data-module={module.module_id}
            className="rounded-card bg-muted p-4"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tabiya-blue text-tabiya-green"
              >
                <Icon className="size-4" />
              </span>
              <span className="grid min-w-0 gap-0.5">
                <span className="font-semibold text-foreground">{t(MODULE_LABEL_KEYS[module.module_id])}</span>
                <span className="text-sm text-muted-foreground">
                  {t(MODULE_CAPTION_KEYS[module.module_id], { value: module.highlight_value?.toLocaleString() })}
                </span>
              </span>
              <span className="ml-auto shrink-0 font-mono text-sm font-semibold tracking-[1px] text-foreground">
                {t("institutions.modal.progress.started", { value: module.started_pct })}
              </span>
            </div>

            {/* Job Readiness is the one module that breaks down into steps. */}
            {module.sub_modules && module.sub_modules.length > 0 && (
              <ul className="mt-3 grid gap-2 border-t pt-3">
                {module.sub_modules.map((subModule) => (
                  <li
                    key={subModule.id}
                    data-testid={DATA_TEST_ID.SUB_MODULE}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-12 text-sm"
                  >
                    <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-green-2" />
                    <span className="text-foreground">{subModule.name}</span>
                    <span className="ml-auto font-mono text-xs tracking-[1px] text-muted-foreground">
                      {t("institutions.modal.progress.subModule", {
                        started: subModule.started.toLocaleString(),
                        completed: subModule.completed_pct,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
