import type { ModuleStatus } from "@/jobseekers/jobseekers.types";
import type { TranslationKey } from "@/i18n/react-i18next";

export const MODULE_STATUS_LABEL_KEYS: Record<ModuleStatus, TranslationKey> = {
  not_started: "jobseekers.status.notStarted",
  in_progress: "jobseekers.status.inProgress",
  completed: "jobseekers.status.completed",
};

const DAY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Stands in for a figure the deployment never recorded — never an empty cell, which reads as a bug. */
export const NO_VALUE = "\u2014";

/** `07 Jul 2026`. UTC-based, so a date never slips a day for a reader west of Greenwich. */
export function formatDay(isoDate: string | null | undefined): string {
  if (!isoDate) return NO_VALUE;
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  return Number.isNaN(date.getTime()) ? isoDate : DAY_FORMATTER.format(date);
}
