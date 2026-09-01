"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & ({ color?: string; theme?: never } | { color?: never; theme: Record<keyof typeof THEMES, string> });
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs",
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
          "[&_.recharts-cartesian-grid_line]:stroke-border/50",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border",
          "[&_.recharts-dot[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-layer]:outline-hidden",
          "[&_.recharts-sector]:outline-hidden",
          "[&_.recharts-sector[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-surface]:outline-hidden",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, itemConfig]) => itemConfig.theme ?? itemConfig.color);

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ?? itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  );
}

const ChartTooltip = RechartsPrimitive.Tooltip;

/**
 * Recharts calls `content` with a runtime shape stricter than any prop type
 * it exports (v3's `TooltipContentProps` marks `active`/`payload` as
 * required, which would force every `<ChartTooltipContent />` call site to
 * pass them). Modelling the shape ourselves keeps it optional for JSX authors.
 */
type ChartTooltipPayloadItem = {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
};

type ChartTooltipContentProps = Omit<React.ComponentProps<"div">, "color"> & {
  active?: boolean;
  payload?: ReadonlyArray<ChartTooltipPayloadItem>;
  label?: React.ReactNode;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: "line" | "dot" | "dashed";
  nameKey?: string;
  labelKey?: string;
  labelClassName?: string;
  color?: string;
  labelFormatter?: (label: React.ReactNode, payload: ReadonlyArray<ChartTooltipPayloadItem>) => React.ReactNode;
  formatter?: (
    value: ChartTooltipPayloadItem["value"],
    name: ChartTooltipPayloadItem["name"],
    item: ChartTooltipPayloadItem,
    index: number,
    payload: ChartTooltipPayloadItem["payload"]
  ) => React.ReactNode;
};

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}: ChartTooltipContentProps) {
  const { config } = useChart();

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null;
    }

    const [item] = payload;
    const key = labelKey ?? item.dataKey ?? item.name ?? "value";
    const itemConfig = getPayloadConfigFromPayload(config, item, key);
    const value =
      !labelKey && typeof label === "string"
        ? (config[label as keyof typeof config]?.label ?? label)
        : itemConfig?.label;

    const resolved = labelFormatter ? labelFormatter(value, payload) : value;
    if (!resolved) return null;

    return <div className={cn("text-primary-foreground/70", labelClassName)}>{resolved}</div>;
  }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

  if (!active || !payload?.length) {
    return null;
  }

  const nestLabel = payload.length === 1 && indicator !== "dot";

  const hasCustomFormatter = Boolean(formatter);
  if (!hasCustomFormatter) {
    const totalAcrossAllSeries = payload.reduce(
      (sum, item) => sum + (typeof item.value === "number" ? item.value : 0),
      0
    );

    return (
      <div
        data-slot="chart-tooltip-content"
        className={cn(
          "grid min-w-32 gap-1 rounded-lg bg-primary px-3 py-2.5 text-xs text-primary-foreground shadow-md",
          className
        )}
      >
        {tooltipLabel}
        <p className="text-2xl font-bold tabular-nums">{totalAcrossAllSeries.toLocaleString()}</p>
        {payload.length > 1 && (
          <p className="text-tabiya-green">
            {payload.map((item, index) => {
              const key = nameKey ?? item.name ?? item.dataKey ?? "value";
              const itemConfig = getPayloadConfigFromPayload(config, item, key);
              const name = itemConfig?.label ?? item.name;
              const value = typeof item.value === "number" ? item.value.toLocaleString() : item.value;
              return (
                <React.Fragment key={item.dataKey ?? index}>
                  {index > 0 && " · "}
                  {value} {typeof name === "string" ? name.toLowerCase() : name}
                </React.Fragment>
              );
            })}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      data-slot="chart-tooltip-content"
      className={cn(
        "grid min-w-32 items-start gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs text-primary-foreground shadow-md",
        className
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const indicatorColor = color ?? (item.payload?.fill as string | undefined) ?? item.color;

          return (
            <div
              key={item.dataKey ?? index}
              className={cn(
                "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-primary-foreground/70",
                indicator === "dot" && "items-center"
              )}
            >
              {formatter && item.value !== undefined && item.name
                ? formatter(item.value, item.name, item, index, item.payload)
                : !hideIndicator && (
                    <div
                      className={cn("shrink-0 rounded-xs border-(--color-border) bg-(--color-bg)", {
                        "h-2.5 w-2.5": indicator === "dot",
                        "w-1": indicator === "line",
                        "w-0 border-[1.5px] border-dashed bg-transparent": indicator === "dashed",
                        "my-0.5": nestLabel && indicator === "dashed",
                      })}
                      style={{ "--color-bg": indicatorColor, "--color-border": indicatorColor } as React.CSSProperties}
                    />
                  )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ChartLegend = RechartsPrimitive.Legend;

function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
}: React.ComponentProps<"div"> &
  Pick<RechartsPrimitive.DefaultLegendContentProps, "payload" | "verticalAlign"> & {
    hideIcon?: boolean;
    nameKey?: string;
  }) {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div
      data-slot="chart-legend-content"
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-5 gap-y-2",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {payload.map((item) => {
        const key = nameKey ?? (typeof item.dataKey === "function" ? undefined : item.dataKey) ?? "value";
        const itemConfig = getPayloadConfigFromPayload(config, item, key);

        return (
          <div key={item.value} className="flex items-center gap-1.5 text-foreground">
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon />
            ) : (
              <div className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: item.color }} />
            )}
            {itemConfig?.label ?? item.value}
          </div>
        );
      })}
    </div>
  );
}

/** Data keys carry `series.value` shapes; unwrap to the leaf key a legend/tooltip can look up in `config`. */
function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string | number) {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const payloadPayload =
    "payload" in payload && typeof payload.payload === "object" && payload.payload !== null
      ? (payload.payload as Record<string, unknown>)
      : undefined;

  let configLabelKey: string = String(key);

  if (key in payload && typeof (payload as Record<string, unknown>)[key] === "string") {
    configLabelKey = (payload as Record<string, unknown>)[key] as string;
  } else if (payloadPayload && key in payloadPayload && typeof payloadPayload[key] === "string") {
    configLabelKey = payloadPayload[key] as string;
  }

  return configLabelKey in config ? config[configLabelKey] : config[key as keyof typeof config];
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle, useChart };
