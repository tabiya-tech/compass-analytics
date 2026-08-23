import type { ModuleId } from "@/access/AccessContext";
import type { JobseekerSummary, ModuleStatus } from "@/jobseekers/jobseekers.types";
import { formatDay } from "@/pages/JobSeekers/utils";

/**
 * Every heading and value the file needs, already translated. Passing them in rather than calling
 * `t` here keeps the builder a pure function of what is on screen — which is exactly what the
 * export promises: the rows in the file are the rows in the table, in the same order.
 */
export interface JobseekersCsvLabels {
  id: string;
  name: string;
  institution: string;
  profileScore: string;
  registered: string;
  lastLogin: string;
  skillsReport: string;
  skillsCount: string;
  skills: string;
  modules: Record<ModuleId, string>;
  statuses: Record<ModuleStatus, string>;
  reportReady: string;
  reportNotReady: string;
}

/** Anything carrying a comma, a quote or a newline is quoted, and inner quotes are doubled. */
function escapeField(value: string | number): string {
  const text = String(value ?? "");
  return /["\n,]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * The roster as CSV, one row per jobseeker in the order given.
 *
 * The file carries a column per deployed module — including Jobs, which the table leaves to the
 * profile drill-down: a spreadsheet has room for it, a roster row does not.
 */
export function buildJobseekersCsv(
  jobseekers: readonly JobseekerSummary[],
  activeModules: readonly ModuleId[],
  labels: JobseekersCsvLabels
): string {
  const headers = [
    labels.id,
    labels.name,
    labels.institution,
    labels.profileScore,
    labels.registered,
    labels.lastLogin,
    ...activeModules.map((moduleId) => labels.modules[moduleId]),
    labels.skillsReport,
    labels.skillsCount,
    labels.skills,
  ];

  const rows = jobseekers.map((jobseeker) => [
    jobseeker.id,
    jobseeker.name,
    jobseeker.institution_name,
    jobseeker.profile_score_pct,
    formatDay(jobseeker.registered_at),
    formatDay(jobseeker.last_login_at),
    ...activeModules.map((moduleId) => labels.statuses[jobseeker.module_status[moduleId] ?? "not_started"]),
    jobseeker.skills_report_ready ? labels.reportReady : labels.reportNotReady,
    jobseeker.skills.length,
    jobseeker.skills.join("; "),
  ]);

  return [headers, ...rows].map((row) => row.map(escapeField).join(",")).join("\n");
}

/** `compass-jobseekers-2026-08-18.csv` — the day it was taken is the only thing that dates it. */
export function jobseekersCsvFilename(today: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `compass-jobseekers-${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}.csv`;
}

/** Hands the file to the browser. The BOM is what makes Excel read the accented names correctly. */
export function downloadCsv(filename: string, contents: string): void {
  const blob = new Blob(["\uFEFF" + contents], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
