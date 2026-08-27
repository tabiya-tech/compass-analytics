import { useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { MODULE_IDS } from "@/access/AccessContext";
import { useAuth } from "@/auth/AuthContext";
import { useFilters } from "@/filters/FiltersContext";
import { createFixedModulesDateRange, deriveGranularity } from "@/filters/filters";
import { AnalyticsService } from "@/analytics/Analytics.service";
import type { CareerExplorerResponse, CareerExplorerSector } from "@/analytics/analytics.types";
import type { CareerExplorerMetrics, SectorBucket } from "@/pages/Modules/types";

export type CareerExplorerState =
  { status: "loading" } | { status: "error"; message: string } | { status: "success"; data: CareerExplorerResponse };

export interface UseCareerExplorerOptions {
  /** Off when the caller won't render this — a disabled hook is simply left at its initial state. */
  enabled?: boolean;
  /** Bump this (e.g. from a `reload()` callback) to force a refetch without changing filters. */
  reloadToken?: number;
}

/** Fetches GET /api/modules/career-explorer, filtered the same way the other module hooks filter theirs. */
export function useCareerExplorer({
  enabled = true,
  reloadToken = 0,
}: UseCareerExplorerOptions = {}): CareerExplorerState {
  const { getIdToken } = useAuth();
  const { filters } = useFilters();
  const [state, setState] = useState<CareerExplorerState>({ status: "loading" });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ status: "loading" });

    (async () => {
      try {
        const token = await getIdToken();
        // No filter on the Modules screen yet — a fixed trailing year stands in until one ships.
        const dateRange = createFixedModulesDateRange();
        const data = await AnalyticsService.getInstance().getCareerExplorer(
          {
            start_date: dateRange.start,
            end_date: dateRange.end,
            granularity: deriveGranularity(dateRange),
            audience_segment: filters.audienceSegment ?? undefined,
            login_method: filters.loginMethod ?? undefined,
            institution_id: filters.institutionDrillDownId ?? undefined,
          },
          token
        );
        if (!cancelled) setState({ status: "success", data });
      } catch (error) {
        Sentry.captureException(error);
        if (!cancelled) setState({ status: "error", message: "Failed to load Career Explorer data." });
      }
    })();

    return () => {
      cancelled = true;
    };
    // dateRange/granularity aren't in this list: the fixed range above doesn't depend on filters.
  }, [getIdToken, filters.audienceSegment, filters.loginMethod, filters.institutionDrillDownId, enabled, reloadToken]);

  return state;
}

/**
 * Sectors come back named, not keyed — upstream aggregates on the name itself. The bucket still
 * needs a stable id for React and for the bar rows, so the name is slugged into one.
 */
export function sectorIdFrom(sectorName: string, index: number): string {
  const slug = sectorName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  // An unnamed (or entirely non-alphanumeric) sector still needs an id no other row shares.
  return slug || `sector-${index}`;
}

function toSectorBucket(sector: CareerExplorerSector, index: number): SectorBucket {
  return {
    id: sectorIdFrom(sector.sector_name, index),
    label: sector.sector_name,
    explorations: sector.total_inquiries,
    uniqueUsers: sector.unique_users,
    isPriority: sector.is_priority,
  };
}

export function toCareerExplorerMetrics(response: CareerExplorerResponse): CareerExplorerMetrics {
  const { summary } = response;
  return {
    moduleId: MODULE_IDS.CAREER_EXPLORER,
    startedPercentage: Math.round(summary.started_percentage),
    exploredUsers: summary.started_users,
    returnedUsers: summary.returned_users,
    returnedSharePercentage: Math.round(summary.returned_percentage),
    prioritySectorUsers: summary.priority_sector_users,
    nonPrioritySectorUsers: summary.non_priority_sector_users,
    // Upstream already ranks these by total inquiries; the order it chose is the order shown.
    topSectors: response.top_sectors.map(toSectorBucket),
    degraded: response.degraded,
  };
}

/** Zeroed and degraded, same as a backend failure — used when the fetch itself throws. */
export function unavailableCareerExplorerMetrics(): CareerExplorerMetrics {
  return toCareerExplorerMetrics({
    summary: {
      total_registered_students: 0,
      started_users: 0,
      started_percentage: 0,
      returned_users: 0,
      returned_percentage: 0,
      priority_sector_users: 0,
      non_priority_sector_users: 0,
    },
    top_sectors: [],
    degraded: true,
  });
}
