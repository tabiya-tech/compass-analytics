import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const uniqueId = "6c2c88aa-5237-44f2-b983-de191a71e415";

export const DATA_TEST_ID = {
  CONTAINER: `stat-tile-container-${uniqueId}`,
  LABEL: `stat-tile-label-${uniqueId}`,
  ICON: `stat-tile-icon-${uniqueId}`,
  VALUE: `stat-tile-value-${uniqueId}`,
  SPARKLINE: `stat-tile-sparkline-${uniqueId}`,
  TREND: `stat-tile-trend-${uniqueId}`,
  CAPTION: `stat-tile-caption-${uniqueId}`,
};

export interface StatTileTrend {
  value: number;
  label?: string;
}

/** "inverse" is the dark, accent-value tile used for headline figures on a light screen. */
export type StatTileTone = "default" | "inverse";

export interface StatTileProps {
  label?: string;
  value: ReactNode;
  icon?: ReactNode;
  caption?: string;
  trend?: StatTileTrend;
  sparkline?: ReactNode;
  tone?: StatTileTone;
  className?: string;
}

const TONE_STYLES = {
  default: {
    card: "",
    label: "text-foreground/70",
    value: "text-foreground",
    caption: "text-muted-foreground",
  },
  inverse: {
    card: "border-transparent bg-tabiya-blue",
    label: "text-white/70",
    value: "text-tabiya-green",
    caption: "text-white/80",
  },
} as const satisfies Record<StatTileTone, Record<string, string>>;

const TREND_STYLES = {
  up: { Icon: TrendingUp, className: "text-green-3" },
  down: { Icon: TrendingDown, className: "text-destructive" },
  flat: { Icon: Minus, className: "text-muted-foreground" },
} as const;

// trendFlat has no {{value}} placeholder, so passing it along is harmless.
const TREND_LABEL_KEYS = {
  up: "shared.statTile.trendUp",
  down: "shared.statTile.trendDown",
  flat: "shared.statTile.trendFlat",
} as const;

// A delta of exactly 0 reads as "no change" rather than a rise.
function directionOf(value: number): keyof typeof TREND_STYLES {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

function TrendIndicator({ value, label }: Readonly<StatTileTrend>) {
  const { t } = useTranslation();
  const direction = directionOf(value);
  const { Icon, className } = TREND_STYLES[direction];
  const magnitude = Math.abs(value);
  const srLabel = t(TREND_LABEL_KEYS[direction], { value: magnitude });

  return (
    <p
      data-slot="stat-tile-trend"
      data-testid={DATA_TEST_ID.TREND}
      data-direction={direction}
      className="flex items-center gap-1.5 text-sm"
    >
      <span className={cn("flex items-center gap-1 font-medium", className)}>
        <Icon aria-hidden="true" className="size-3.5" />
        <span aria-hidden="true">{magnitude}%</span>
        <span className="sr-only">{srLabel}</span>
      </span>
      {label && <span className="text-muted-foreground">{label}</span>}
    </p>
  );
}

export function StatTile({
  label,
  value,
  icon,
  caption,
  trend,
  sparkline,
  tone = "default",
  className,
}: Readonly<StatTileProps>) {
  const toneStyles = TONE_STYLES[tone];

  return (
    <Card
      data-slot="stat-tile"
      data-testid={DATA_TEST_ID.CONTAINER}
      data-tone={tone}
      className={cn("gap-4 py-5", toneStyles.card, className)}
    >
      {(label || icon) && (
        <CardHeader className="px-5">
          <CardDescription
            data-testid={DATA_TEST_ID.LABEL}
            className={cn("font-mono text-xs tracking-[2px] uppercase", toneStyles.label)}
          >
            {label}
          </CardDescription>
          {icon && (
            <CardAction
              data-slot="stat-tile-icon"
              data-testid={DATA_TEST_ID.ICON}
              aria-hidden="true"
              className="text-muted-foreground [&_svg]:size-4"
            >
              {icon}
            </CardAction>
          )}
        </CardHeader>
      )}
      <CardContent className="grid gap-1.5 px-5">
        <div className="flex items-center justify-between gap-4">
          <p
            data-slot="stat-tile-value"
            data-testid={DATA_TEST_ID.VALUE}
            className={cn("text-4xl font-bold tracking-tight", toneStyles.value)}
          >
            {value}
          </p>
          {sparkline && (
            <div data-slot="stat-tile-sparkline" data-testid={DATA_TEST_ID.SPARKLINE} className="shrink-0">
              {sparkline}
            </div>
          )}
        </div>
        {trend && <TrendIndicator value={trend.value} label={trend.label} />}
        {caption && (
          <p
            data-slot="stat-tile-caption"
            data-testid={DATA_TEST_ID.CAPTION}
            className={cn("text-sm", toneStyles.caption)}
          >
            {caption}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
