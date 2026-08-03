import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const uniqueId = "0d070f6c-22b9-4885-a26b-817502d1591d";

export const DATA_TEST_ID = {
  CONTAINER: `completion-ring-container-${uniqueId}`,
  TRACK: `completion-ring-track-${uniqueId}`,
  PROGRESS: `completion-ring-progress-${uniqueId}`,
  LABEL: `completion-ring-label-${uniqueId}`,
};

export interface CompletionRingProps {
  value: number;
  label?: string;
  className?: string;
}

const RADIUS = 42;
const STROKE_WIDTH = 10;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Below halfway reads as needing attention; a full ring gets its own, more emphatic green.
const colorOf = (percentage: number): string => {
  if (percentage >= 100) return "stroke-green-3";
  if (percentage >= 50) return "stroke-green-2";
  return "stroke-amber-400";
};

export function CompletionRing({ value, label, className }: Readonly<CompletionRingProps>) {
  const { t } = useTranslation();
  const percentage = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div
      data-slot="completion-ring"
      data-testid={DATA_TEST_ID.CONTAINER}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
      aria-label={t("shared.completionRing.label", { value: percentage })}
      className={cn("relative size-24", className)}
    >
      {/* Rotated so the arc starts at 12 o'clock. */}
      <svg viewBox="0 0 100 100" aria-hidden="true" className="size-full -rotate-90">
        <circle
          data-slot="completion-ring-track"
          data-testid={DATA_TEST_ID.TRACK}
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          className="stroke-muted"
        />
        <circle
          data-slot="completion-ring-progress"
          data-testid={DATA_TEST_ID.PROGRESS}
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - percentage / 100)}
          className={cn(
            colorOf(percentage),
            "transition-[stroke-dashoffset,stroke] duration-(--duration-base) ease-(--ease-out)"
          )}
        />
      </svg>
      {label && (
        <span
          data-slot="completion-ring-label"
          data-testid={DATA_TEST_ID.LABEL}
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-foreground"
        >
          {label}
        </span>
      )}
    </div>
  );
}
