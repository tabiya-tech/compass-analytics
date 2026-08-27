import { useCallback, useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { useAuth } from "@/auth/AuthContext";
import { InstitutionsService } from "@/institutions/services/Institutions.service";
import type { InstitutionDetail } from "@/institutions/institutions.types";

export type InstitutionDetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "success"; data: InstitutionDetail };

/** Fetches the drill-down for one institution; stays idle until one is picked. */
export function useInstitutionDetail(institutionId: string | null): InstitutionDetailState {
  const { getIdToken } = useAuth();
  const [state, setState] = useState<InstitutionDetailState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0); // bumped by retry() to fetch the same institution again

  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);

  useEffect(() => {
    if (!institutionId) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    (async () => {
      try {
        const token = await getIdToken();
        const data = await InstitutionsService.getInstance().getInstitution(institutionId, token);
        if (!cancelled) setState({ status: "success", data });
      } catch (error) {
        Sentry.captureException(error);
        if (!cancelled) setState({ status: "error", retry });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getIdToken, institutionId, attempt, retry]);

  return state;
}
