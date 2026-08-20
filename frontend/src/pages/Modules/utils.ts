import type { ModuleId } from "@/access/AccessContext";

/** One module renders inline on Overview; two+ get the Modules screen with a timeline. */
export function rendersModulesInline(activeModules: readonly ModuleId[]): boolean {
  return activeModules.length === 1;
}

/** The one module an inline deployment shows, or null when there is a Modules screen instead. */
export function soleActiveModule(activeModules: readonly ModuleId[]): ModuleId | null {
  return rendersModulesInline(activeModules) ? activeModules[0] : null;
}

/** How the timeline, the scroll-spy and any deep link all address a module's section. */
export function moduleSectionElementId(moduleId: ModuleId): string {
  return `module-section-${moduleId}`;
}
