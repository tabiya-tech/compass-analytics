import { useCallback, useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { useAuth } from "@/auth/AuthContext";
import { JobseekersService, type GetJobseekersParams } from "@/jobseekers/services/Jobseekers.service";
import type { JobseekersResponse } from "@/jobseekers/jobseekers.types";

export type JobseekersState =
  { status: "loading" } | { status: "error"; retry: () => void } | { status: "success"; data: JobseekersResponse };

// Pass memoized params — an unmemoized object here would refetch on every render.
export function useJobseekers(params: GetJobseekersParams): JobseekersState {
  const { getIdToken } = useAuth();
  const [state, setState] = useState<JobseekersState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0); // bumped by retry() to run the same query again

  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);

  useEffect(() => {
    let cancelled = false;

    // No reset to "loading": a re-sort or keystroke keeps the current rows until the new ones land.
    (async () => {
      try {
        const token = await getIdToken();
        const data = await JobseekersService.getInstance().getJobseekers(params, token);
        if (!cancelled) setState({ status: "success", data });
      } catch (error) {
        Sentry.captureException(error);
        if (!cancelled) setState({ status: "error", retry });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getIdToken, params, attempt, retry]);

  return state;
}
