import { useCallback, useEffect, useState, type CSSProperties } from "react";
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

const SPY_ROOT_MARGIN = "-140px 0px -55% 0px";

const CONNECTOR_SQUARE_DOTS =
  "linear-gradient(to right, var(--color-green-2) var(--connector-thickness), transparent var(--connector-thickness))";
const CONNECTOR_SQUARE_DOT_AND_GAP = "var(--connector-pitch) var(--connector-thickness)";

const TIMELINE_GEOMETRY = {
  "--marker-size": "48px",
  "--connector-thickness": "2px",
  "--connector-pitch": "10px",
  "--connector-inset": "26px",
} as CSSProperties;

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
      className={cn("sticky top-0 z-[5] bg-surface-page", className)}
    >
      <ol className="flex items-start border-b py-5" style={TIMELINE_GEOMETRY}>
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
              className="relative flex min-w-0 flex-1 flex-col items-center"
            >
              {/* Spans this step's centre to the next one's, stopping clear of both markers. */}
              {index < modules.length - 1 && (
                <span
                  data-testid={DATA_TEST_ID.CONNECTOR}
                  aria-hidden="true"
                  className="absolute top-[calc((var(--marker-size)_-_var(--connector-thickness))_/_2)] left-[calc(50%_+_var(--connector-inset))] right-[calc(var(--connector-inset)_-_50%)] h-(--connector-thickness)"
                  style={{
                    backgroundImage: CONNECTOR_SQUARE_DOTS,
                    backgroundSize: CONNECTOR_SQUARE_DOT_AND_GAP,
                    backgroundRepeat: "repeat-x",
                  }}
                />
              )}

              <button
                type="button"
                onClick={() => jumpToModule(module.id)}
                aria-current={isActive ? "true" : undefined}
                aria-label={t("modules.timeline.jump", { module: label })}
                className="flex cursor-pointer flex-col items-center gap-2 rounded-md px-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-(--marker-size) shrink-0 items-center justify-center rounded-full",
                    "border-[3px] border-surface-page transition-all duration-200 ease-(--ease-out)",
                    isActive
                      ? "bg-tabiya-green text-tabiya-blue shadow-[0_4px_14px_rgba(0,255,145,0.35)]"
                      : "bg-tabiya-blue text-tabiya-green shadow-sm"
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="grid justify-items-center gap-0.5 text-center">
                  <span
                    data-testid={DATA_TEST_ID.STEP_LABEL}
                    className="max-w-40 truncate text-[13px] font-semibold text-foreground"
                  >
                    {label}
                  </span>
                  <span
                    data-testid={DATA_TEST_ID.STEP_STARTED}
                    className="font-mono text-[10.5px] tracking-[1px] text-green-3"
                  >
                    {t("modules.timeline.started", { value: module.startedPercentage })}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
