import { useCallback, useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { useAuth } from "@/auth/AuthContext";
import { UserService } from "@/user/User.service";
import type { RoleRecord } from "@/user/user.types";

export type RolesState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; roles: readonly RoleRecord[] };

export function useRoles(): RolesState {
  const { getIdToken } = useAuth();
  const [state, setState] = useState<RolesState>({ status: "loading" });

  const fetchRoles = useCallback(async () => {
    try {
      const token = await getIdToken();
      const roles = await UserService.getInstance().getRoles(token);
      setState({ status: "success", roles });
    } catch (error) {
      Sentry.captureException(error);
      setState({ status: "error" });
    }
  }, [getIdToken]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return state;
}
