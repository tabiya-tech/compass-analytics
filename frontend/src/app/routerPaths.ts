import type { ModuleId } from "@/access/AccessContext";

export const routerPaths = {
  ROOT: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  JOBSEEKERS: "/jobseekers",
  MODULES: "/modules",
  MODULE: "/modules/:moduleId",
  SETTINGS: "/settings",
} as const;

/** Link target for a specific module, e.g. modulePath("jobs") === "/modules/jobs". */
export function modulePath(moduleId: ModuleId): string {
  return `${routerPaths.MODULES}/${moduleId}`;
}
