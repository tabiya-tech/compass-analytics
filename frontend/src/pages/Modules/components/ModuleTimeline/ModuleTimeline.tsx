import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ModuleId } from "@/access/AccessContext";
import { MODULE_ICONS, MODULE_LABEL_KEYS } from "@/access/moduleDisplay";
import { modulePath } from "@/app/routerPaths";
import { moduleSectionElementId } from "@/pages/Modules/utils";
import { cn } from "@/lib/utils";

const uniqueId = "3f81a5c7-9e42-4b6d-a0c8-15d7e93b2f40";

export const DATA_TEST_ID = {
  CONTAINER: `module-timeline-container-${uniqueId}`,
  STEP: `module-timeline-step-${uniqueId}`,
  STEP_LABEL: `module-timeline-step-label-${uniqueId}`,
  STEP_STARTED: `module-timeline-step-started-${uniqueId}`,
  CONNECTOR: `module-timeline-connector-${uniqueId}`,
};

/** The band a section reaches into to count as the one being read: under the sticky bar, above mid-viewport. */
const SPY_ROOT_MARGIN = "-140px 0px -55% 0px";

export interface ModuleTimelineItem {
  id: ModuleId;
  startedPercentage: number;
}

export interface ModuleTimelineProps {
  /** In the order the deployment runs them — the same order their sections appear in below. */
  modules: readonly ModuleTimelineItem[];
  className?: string;
}

/** The last module in deployment order that's in the band. Assumes modules render in activeModules order. */
export function pickActiveModule(
  moduleIds: readonly ModuleId[],
  intersectingElementIds: ReadonlySet<string>
): ModuleId | null {
  return (
    [...moduleIds].reverse().find((moduleId) => intersectingElementIds.has(moduleSectionElementId(moduleId))) ?? null
  );
}

function scrollToModule(moduleId: ModuleId) {
  document.getElementById(moduleSectionElementId(moduleId))?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * The stepper across a deployment's modules: each one's share of jobseekers who
 * started it, a jump to its figures, and a highlight that follows the scroll.
 */
export function ModuleTimeline({ modules, className }: Readonly<ModuleTimelineProps>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { moduleId: requestedModuleId } = useParams();
  const [activeModuleId, setActiveModuleId] = useState<ModuleId | null>(null);

  const moduleIdsKey = modules.map((module) => module.id).join(",");

  const jumpToModule = useCallback(
    (target: ModuleId) => {
      // Lit straight away: the smooth scroll takes a moment to reach the section.
      setActiveModuleId(target);
      // Replaced, not pushed — jumping around one screen shouldn't fill the back button.
      void navigate(modulePath(target), { replace: true });
      scrollToModule(target);
    },
    [navigate]
  );

  useEffect(() => {
    const moduleIds = moduleIdsKey.split(",").filter(Boolean) as ModuleId[];
    setActiveModuleId((previous) => (previous && moduleIds.includes(previous) ? previous : (moduleIds[0] ?? null)));

    const sections = moduleIds
      .map((moduleId) => document.getElementById(moduleSectionElementId(moduleId)))
      .filter((section): section is HTMLElement => section !== null);
    if (sections.length === 0) return;

    const intersecting = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) intersecting.add(entry.target.id);
          else intersecting.delete(entry.target.id);
        }
        // Between two sections nothing intersects; the last answer still stands.
        const next = pickActiveModule(moduleIds, intersecting);
        if (next) setActiveModuleId(next);
      },
      { rootMargin: SPY_ROOT_MARGIN, threshold: 0 }
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [moduleIdsKey]);

  // A link straight to one module opens the screen at it, rather than at the top.
  useEffect(() => {
    const target = moduleIdsKey.split(",").find((moduleId) => moduleId === requestedModuleId) as ModuleId | undefined;
    if (!target) return;
    setActiveModuleId(target);
    scrollToModule(target);
  }, [requestedModuleId, moduleIdsKey]);

  return (
    <nav
      data-slot="module-timeline"
      data-testid={DATA_TEST_ID.CONTAINER}
      aria-label={t("modules.timeline.label")}
      className={cn("sticky top-0 z-20 border-b bg-background/95 backdrop-blur-sm", className)}
    >
      <ol className="flex items-start justify-between gap-1 px-2 py-6">
        {modules.map((module, index) => {
          const Icon = MODULE_ICONS[module.id];
          const isActive = module.id === activeModuleId;
          const label = t(MODULE_LABEL_KEYS[module.id]);

          return (
            <li
              key={module.id}
              data-testid={DATA_TEST_ID.STEP}
              data-module={module.id}
              data-active={isActive || undefined}
              className="flex min-w-0 flex-1 items-start last:flex-none"
            >
              <button
                type="button"
                onClick={() => jumpToModule(module.id)}
                aria-current={isActive ? "true" : undefined}
                aria-label={t("modules.timeline.jump", { module: label })}
                className="grid cursor-pointer justify-items-center gap-2 rounded-md px-2 py-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-11 items-center justify-center rounded-full transition-colors duration-(--duration-base)",
                    isActive
                      ? "bg-tabiya-green text-tabiya-blue shadow-[0_0_0_6px_rgba(0,255,145,0.25)]"
                      : "bg-tabiya-blue text-tabiya-green"
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span
                  data-testid={DATA_TEST_ID.STEP_LABEL}
                  className={cn(
                    "max-w-40 truncate text-sm font-semibold",
                    isActive ? "text-foreground" : "text-foreground/80"
                  )}
                >
                  {label}
                </span>
                <span
                  data-testid={DATA_TEST_ID.STEP_STARTED}
                  className="font-mono text-xs tracking-[1px] text-muted-foreground"
                >
                  {t("modules.timeline.started", { value: module.startedPercentage })}
                </span>
              </button>

              {index < modules.length - 1 && (
                <span
                  data-testid={DATA_TEST_ID.CONNECTOR}
                  aria-hidden="true"
                  className="mt-5.5 h-px min-w-4 flex-1 border-t-2 border-dotted border-green-2"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
