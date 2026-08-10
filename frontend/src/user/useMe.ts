import { useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { useAuth } from "@/auth/AuthContext";
import { UserService, UserApiError } from "@/user/User.service";
import type { MeResponse } from "@/user/user.types";

export type MeState =
  | { status: "loading" }
  | { status: "unprovisioned" } // authenticated, but no profile yet (backend 404)
  | { status: "error"; message: string }
  | { status: "success"; data: MeResponse };

export function useMe(): MeState {
  const { getIdToken } = useAuth();
  const [state, setState] = useState<MeState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    (async () => {
      try {
        const token = await getIdToken();
        const data = await UserService.getInstance().getMe(token);
        if (!cancelled) setState({ status: "success", data });
      } catch (error) {
        // A 404 is an expected state (first login, not yet provisioned), not an
        // error worth reporting — surface it distinctly so the UI can prompt the
        // user rather than showing a generic failure.
        if (error instanceof UserApiError && error.status === 404) {
          if (!cancelled) setState({ status: "unprovisioned" });
          return;
        }
        Sentry.captureException(error);
        if (!cancelled) setState({ status: "error", message: "Failed to load your profile." });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getIdToken]);

  return state;
}
