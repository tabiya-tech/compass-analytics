import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { InstitutionsService } from "@/institutions/services/Institutions.service";
import type { InstitutionsQuery, InstitutionsResponse } from "@/institutions/institutions.types";

export type InstitutionsState =
  { status: "loading" } | { status: "error"; retry: () => void } | { status: "success"; data: InstitutionsResponse };

/** Refetches whenever the query changes — pass a memoized query so sorting doesn't loop. */
export function useInstitutions(query: InstitutionsQuery): InstitutionsState {
  const { getIdToken } = useAuth();
  const [state, setState] = useState<InstitutionsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0); // bumped by retry() to run the same query again

  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);

  useEffect(() => {
    let cancelled = false;

    // No reset to "loading": a re-sort or keystroke keeps the current rows until the new ones land.
    (async () => {
      try {
        const token = await getIdToken();
        const data = await InstitutionsService.getInstance().getInstitutions(query, token);
        if (!cancelled) setState({ status: "success", data });
      } catch (error) {
        console.error("Failed to load institutions:", error);
        if (!cancelled) setState({ status: "error", retry });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getIdToken, query, attempt, retry]);

  return state;
}
