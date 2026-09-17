import { useCallback, useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { useAuth } from "@/auth/AuthContext";
import { InstitutionsService } from "@/institutions/services/Institutions.service";
import type { InstitutionsResponse } from "@/institutions/institutions.types";

export type InstitutionsState =
  { status: "loading" } | { status: "error"; retry: () => void } | { status: "success"; data: InstitutionsResponse };

export function useInstitutions(): InstitutionsState {
  const { getIdToken } = useAuth();
  const [state, setState] = useState<InstitutionsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0); // bumped by retry() to run the same query again

  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await getIdToken();
        const data = await InstitutionsService.getInstance().getInstitutions(token);
        if (!cancelled) setState({ status: "success", data });
      } catch (error) {
        Sentry.captureException(error);
        if (!cancelled) setState({ status: "error", retry });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getIdToken, attempt, retry]);

  return state;
}
