import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  createInitialFilters,
  deriveGranularity,
  getActiveFilters,
  type ChipFilterKey,
  type DateRange,
  type FiltersPatch,
  type FiltersState,
} from "@/filters/filters";

export interface FiltersContextValue {
  filters: FiltersState;
  patchFilters: (patch: FiltersPatch) => void; // a dateRange change re-derives granularity
  setDateRange: (range: DateRange) => void;
  clearFilter: (key: ChipFilterKey) => void;
  clearAll: () => void; // chip filters only — keeps the date range
  activeFilters: { key: ChipFilterKey; value: string }[];
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function useFilters(): FiltersContextValue {
  const context = useContext(FiltersContext);
  if (!context) {
    throw new Error("useFilters must be used within a FiltersProvider.");
  }
  return context;
}

/** Mount once around the filter bars and the data they filter, so they share one state. */
export function FiltersProvider({
  children,
  initialFilters,
}: Readonly<{ children: ReactNode; initialFilters?: FiltersState }>) {
  const [filters, setFilters] = useState<FiltersState>(() => initialFilters ?? createInitialFilters());

  const patchFilters = useCallback((patch: FiltersPatch) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      return patch.dateRange ? { ...next, granularity: deriveGranularity(patch.dateRange) } : next;
    });
  }, []);

  const setDateRange = useCallback((range: DateRange) => patchFilters({ dateRange: range }), [patchFilters]);
  const clearFilter = useCallback((key: ChipFilterKey) => setFilters((prev) => ({ ...prev, [key]: null })), []);
  const clearAll = useCallback(
    () => setFilters((prev) => ({ ...prev, institutionDrillDownId: null, audienceSegment: null, loginMethod: null })),
    []
  );

  const value = useMemo<FiltersContextValue>(
    () => ({
      filters,
      patchFilters,
      setDateRange,
      clearFilter,
      clearAll,
      activeFilters: getActiveFilters(filters),
    }),
    [filters, patchFilters, setDateRange, clearFilter, clearAll]
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}
