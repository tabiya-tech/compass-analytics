import { useCallback, useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { useAuth } from "@/auth/AuthContext";
import { JobseekersService } from "@/jobseekers/services/Jobseekers.service";
import type { JobseekerDetail } from "@/jobseekers/jobseekers.types";

export type JobseekerDetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "success"; data: JobseekerDetail };

/** Fetches the profile for one jobseeker; stays idle until one is picked. */
export function useJobseekerDetail(jobseekerId: string | null): JobseekerDetailState {
  const { getIdToken } = useAuth();
  const [state, setState] = useState<JobseekerDetailState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0); // bumped by retry() to fetch the same jobseeker again

  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);

  useEffect(() => {
    if (!jobseekerId) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    (async () => {
      try {
        const token = await getIdToken();
        const data = await JobseekersService.getInstance().getJobseeker(jobseekerId, token);
        if (!cancelled) setState({ status: "success", data });
      } catch (error) {
        Sentry.captureException(error);
        if (!cancelled) setState({ status: "error", retry });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getIdToken, jobseekerId, attempt, retry]);

  return state;
}
