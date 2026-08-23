import { useTranslation } from "react-i18next";
import { MODULE_IDS } from "@/access/AccessContext";
import { MODULE_ICONS, MODULE_LABEL_KEYS } from "@/access/moduleDisplay";
import { Badge } from "@/components/ui/badge";
import type { JobseekerModuleProgress, ModuleStatus } from "@/jobseekers/jobseekers.types";
import { MODULE_STATUS_LABEL_KEYS } from "@/pages/JobSeekers/utils";
import { cn } from "@/lib/utils";

const uniqueId = "6a9c38f1-4b70-45de-91a2-8c5f0e37bd94";

export const DATA_TEST_ID = {
  CONTAINER: `module-progress-list-container-${uniqueId}`,
  ROW: `module-progress-list-row-${uniqueId}`,
  SUB_MODULE: `module-progress-list-sub-module-${uniqueId}`,
  SUB_MODULE_COUNT: `module-progress-list-sub-module-count-${uniqueId}`,
};

const STATUS_BADGE_CLASSES: Record<ModuleStatus, string> = {
  completed: "bg-tabiya-green text-tabiya-blue",
  in_progress: "bg-amber-100 text-amber-800",
  not_started: "bg-transparent text-muted-foreground",
};

const SUB_MODULE_DOT_CLASSES: Record<ModuleStatus, string> = {
  completed: "bg-green-3",
  in_progress: "bg-amber-400",
  not_started: "bg-border",
};

export interface ModuleProgressListProps {
  modules: readonly JobseekerModuleProgress[];
}

function StatusBadge({ status }: Readonly<{ status: ModuleStatus }>) {
  const { t } = useTranslation();
  return (
    <Badge variant="secondary" className={cn("shrink-0 px-3 py-1", STATUS_BADGE_CLASSES[status])}>
      {t(MODULE_STATUS_LABEL_KEYS[status])}
    </Badge>
  );
}

/** Where this jobseeker stands in every deployed module, Job Readiness broken down by step. */
export function ModuleProgressList({ modules }: Readonly<ModuleProgressListProps>) {
  const { t } = useTranslation();

  return (
    <ul data-testid={DATA_TEST_ID.CONTAINER} className="grid gap-3">
      {modules.map((module) => {
        const Icon = MODULE_ICONS[module.module_id];
        const started = module.status !== "not_started";
        // Job Readiness is the one module that breaks down into steps, and only once it is started.
        const subModules = started ? module.sub_modules : undefined;
        const completedSteps = subModules?.filter((step) => step.status === "completed").length ?? 0;

        return (
          <li
            key={module.module_id}
            data-testid={DATA_TEST_ID.ROW}
            data-module={module.module_id}
            className="overflow-hidden rounded-card bg-muted"
          >
            <div className="flex items-center gap-3 p-4">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                  started ? "bg-tabiya-blue text-tabiya-green" : "bg-border text-card"
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="font-semibold text-foreground">{t(MODULE_LABEL_KEYS[module.module_id])}</span>
                {module.module_id === MODULE_IDS.BUILD_YOUR_PROFILE && module.phase && (
                  <span className="text-sm text-muted-foreground">
                    {t("jobseekers.profileModal.progress.phase", { value: module.phase })}
                  </span>
                )}
              </span>
              {subModules && subModules.length > 0 ? (
                <span
                  data-testid={DATA_TEST_ID.SUB_MODULE_COUNT}
                  className="shrink-0 font-mono text-sm font-semibold tracking-[1px] text-foreground"
                >
                  {t("jobseekers.profileModal.progress.stepsCompleted", {
                    completed: completedSteps,
                    total: subModules.length,
                  })}
                </span>
              ) : (
                <StatusBadge status={module.status} />
              )}
            </div>

            {subModules && subModules.length > 0 && (
              <ul className="grid gap-2 border-t px-4 py-3 pl-16">
                {subModules.map((step) => (
                  <li
                    key={step.id}
                    data-testid={DATA_TEST_ID.SUB_MODULE}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                  >
                    <span
                      aria-hidden="true"
                      className={cn("size-1.5 shrink-0 rounded-full", SUB_MODULE_DOT_CLASSES[step.status])}
                    />
                    <span className="text-foreground">{step.name}</span>
                    <span
                      className={cn(
                        "ml-auto",
                        step.status === "completed" ? "font-semibold text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {t(MODULE_STATUS_LABEL_KEYS[step.status])}
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
