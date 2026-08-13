import type { ComponentType } from "react";
import { Briefcase, Compass, GraduationCap, MessageCircle } from "lucide-react";
import { MODULE_IDS, type ModuleId } from "@/access/AccessContext";
import type { TranslationKey } from "@/i18n/react-i18next";

export const MODULE_LABEL_KEYS: Record<ModuleId, TranslationKey> = {
  [MODULE_IDS.BUILD_YOUR_PROFILE]: "nav.modulesSection.buildYourProfile",
  [MODULE_IDS.JOB_READINESS]: "nav.modulesSection.jobReadiness",
  [MODULE_IDS.CAREER_EXPLORER]: "nav.modulesSection.careerExplorer",
  [MODULE_IDS.JOBS]: "nav.modulesSection.jobs",
};

export const MODULE_ICONS: Record<ModuleId, ComponentType<{ className?: string }>> = {
  [MODULE_IDS.BUILD_YOUR_PROFILE]: MessageCircle,
  [MODULE_IDS.JOB_READINESS]: GraduationCap,
  [MODULE_IDS.CAREER_EXPLORER]: Compass,
  [MODULE_IDS.JOBS]: Briefcase,
};

export const MODULE_ORDER: readonly ModuleId[] = Object.values(MODULE_IDS);
