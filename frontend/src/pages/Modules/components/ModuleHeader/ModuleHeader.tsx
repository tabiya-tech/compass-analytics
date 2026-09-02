import { useTranslation } from "react-i18next";
import { MODULE_IDS, type ModuleId } from "@/access/AccessContext";
import { MODULE_ICONS } from "@/access/moduleDisplay";
import type { TranslationKey } from "@/i18n/react-i18next";
import { cn } from "@/lib/utils";

const uniqueId = "0c74e9b2-5a31-4d68-8b0f-7e2a91d4c6f5";

export const DATA_TEST_ID = {
  CONTAINER: `module-header-container-${uniqueId}`,
  ICON: `module-header-icon-${uniqueId}`,
  EYEBROW: `module-header-eyebrow-${uniqueId}`,
  HEADLINE: `module-header-headline-${uniqueId}`,
};

/** Each module is introduced by the question its figures answer, not by its own name. */
const MODULE_HEADER_KEYS: Record<ModuleId, { eyebrow: TranslationKey; headline: TranslationKey }> = {
  [MODULE_IDS.BUILD_YOUR_PROFILE]: {
    eyebrow: "modules.headers.buildYourProfile.eyebrow",
    headline: "modules.headers.buildYourProfile.headline",
  },
  [MODULE_IDS.JOB_READINESS]: {
    eyebrow: "modules.headers.jobReadiness.eyebrow",
    headline: "modules.headers.jobReadiness.headline",
  },
  [MODULE_IDS.CAREER_EXPLORER]: {
    eyebrow: "modules.headers.careerExplorer.eyebrow",
    headline: "modules.headers.careerExplorer.headline",
  },
  [MODULE_IDS.JOBS]: {
    eyebrow: "modules.headers.jobs.eyebrow",
    headline: "modules.headers.jobs.headline",
  },
};

export interface ModuleHeaderProps {
  moduleId: ModuleId;
  className?: string;
}

/** A module's own chrome — distinct from ScreenHead, which titles a whole screen. Several appear on one screen. */
export function ModuleHeader({ moduleId, className }: Readonly<ModuleHeaderProps>) {
  const { t } = useTranslation();
  const Icon = MODULE_ICONS[moduleId];
  const copy = MODULE_HEADER_KEYS[moduleId];

  return (
    <header
      data-slot="module-header"
      data-testid={DATA_TEST_ID.CONTAINER}
      data-module={moduleId}
      className={cn("flex items-center gap-5", className)}
    >
      <span
        data-testid={DATA_TEST_ID.ICON}
        aria-hidden="true"
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-tabiya-blue text-tabiya-green"
      >
        <Icon className="size-6" />
      </span>
      <div className="grid min-w-0 gap-1">
        <p data-testid={DATA_TEST_ID.EYEBROW} className="font-mono text-xs tracking-[2px] text-green-3 uppercase">
          {t(copy.eyebrow)}
        </p>
        <h2
          data-testid={DATA_TEST_ID.HEADLINE}
          className="text-[1.688rem] font-semibold tracking-tight text-balance text-foreground"
        >
          {t(copy.headline)}
        </h2>
      </div>
    </header>
  );
}
