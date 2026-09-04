import { useCallback, useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { useAuth } from "@/auth/AuthContext";
import { UserService } from "@/user/User.service";
import type { RoleRecord } from "@/user/user.types";

export type RolesState =
  { status: "loading" } | { status: "error"; retry: () => void } | { status: "success"; roles: readonly RoleRecord[] };

export function useRoles(): RolesState {
  const { getIdToken } = useAuth();
  const [state, setState] = useState<RolesState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    (async () => {
      try {
        const token = await getIdToken();
        const roles = await UserService.getInstance().getRoles(token);
        if (!cancelled) setState({ status: "success", roles });
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
