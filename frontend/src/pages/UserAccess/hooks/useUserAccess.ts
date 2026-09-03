import { useCallback, useEffect, useMemo, useState } from "react";
import * as Sentry from "@sentry/react";
import { useAuth } from "@/auth/AuthContext";
import { UserService } from "@/user/User.service";
import type { AssignRoleRequest, ManagedUser, RoleRecord } from "@/user/user.types";

export interface UserAccessEntry {
  user: ManagedUser;
  role: RoleRecord | null;
  hasAccess: boolean;
}

export type UserAccessState =
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "success"; items: readonly UserAccessEntry[] };

/** A change that did not go through. "refresh" means the write landed and only the re-read failed. */
export interface UserAccessFailure {
  kind: "grant" | "revoke" | "refresh";
  entry: UserAccessEntry;
}

export interface UserAccessController {
  state: UserAccessState;
  pendingUserIds: ReadonlySet<string>;
  failure: UserAccessFailure | null;
  grantRole: (entry: UserAccessEntry, request: AssignRoleRequest) => Promise<void>;
  revokeAccess: (entry: UserAccessEntry) => Promise<void>;
}

export function toEntry(user: ManagedUser, rolesById: Map<string, RoleRecord>): UserAccessEntry {
  const primaryRole = user.roles.length > 0 ? (rolesById.get(user.roles[0].role_id) ?? null) : null;
  return { user, role: primaryRole, hasAccess: user.roles.length > 0 };
}

type UsersState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; users: readonly ManagedUser[] };

export function useUserAccess(roles: readonly RoleRecord[]): UserAccessController {
  const { getIdToken } = useAuth();
  const [usersState, setUsersState] = useState<UsersState>({ status: "loading" });
  const [pendingUserIds, setPendingUserIds] = useState<ReadonlySet<string>>(new Set());
  const [failure, setFailure] = useState<UserAccessFailure | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);

  const fetchUsers = useCallback(async (): Promise<ManagedUser[]> => {
    const token = await getIdToken();
    return UserService.getInstance().getManagedUsers(token);
  }, [getIdToken]);

  useEffect(() => {
    let cancelled = false;
    setUsersState({ status: "loading" });

    (async () => {
      try {
        const users = await fetchUsers();
        if (!cancelled) setUsersState({ status: "success", users });
      } catch (error) {
        Sentry.captureException(error);
        if (!cancelled) setUsersState({ status: "error" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchUsers, attempt]);

  const rolesById = useMemo(() => new Map(roles.map((role) => [role._id, role])), [roles]);

  const state = useMemo<UserAccessState>(() => {
    if (usersState.status === "loading") return { status: "loading" };
    if (usersState.status === "error") return { status: "error", retry };
    return { status: "success", items: usersState.users.map((user) => toEntry(user, rolesById)) };
  }, [usersState, rolesById, retry]);

  const markPending = useCallback((userId: string, pending: boolean) => {
    setPendingUserIds((previous) => {
      const next = new Set(previous);
      if (pending) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }, []);

  const applyChange = useCallback(
    async (entry: UserAccessEntry, kind: "grant" | "revoke", write: (token: string) => Promise<unknown>) => {
      const { user_id: userId } = entry.user;
      markPending(userId, true);
      setFailure(null);

      try {
        await write(await getIdToken());
      } catch (error) {
        Sentry.captureException(error);
        setFailure({ kind, entry });
        try {
          setUsersState({ status: "success", users: await fetchUsers() });
        } catch (refreshError) {
          Sentry.captureException(refreshError);
        }
        markPending(userId, false);
        return;
      }

      try {
        const users = await fetchUsers();
        setUsersState({ status: "success", users });
      } catch (error) {
        Sentry.captureException(error);
        setFailure({ kind: "refresh", entry });
      } finally {
        markPending(userId, false);
      }
    },
    [fetchUsers, getIdToken, markPending]
  );

  const grantRole = useCallback(
    (entry: UserAccessEntry, request: AssignRoleRequest) =>
      applyChange(entry, "grant", (token) => UserService.getInstance().assignRole(entry.user.user_id, request, token)),
    [applyChange]
  );

  const revokeAccess = useCallback(
    (entry: UserAccessEntry) =>
      applyChange(entry, "revoke", async (token) => {
        const service = UserService.getInstance();
        for (const userRole of entry.user.roles) {
          await service.revokeRole(entry.user.user_id, userRole.role_id, token);
        }
      }),
    [applyChange]
  );

  return { state, pendingUserIds, failure, grantRole, revokeAccess };
}
