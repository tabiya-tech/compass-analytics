import { useCallback, useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { useAuth } from "@/auth/AuthContext";
import { roleFromPermissions, type Role } from "@/access/roles";
import { UserService } from "@/user/User.service";
import { ALL_INSTITUTIONS, type ManagedUser } from "@/user/user.types";

export interface UserAccessEntry {
  user: ManagedUser;
  role: Role | null;
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
  grantRole: (entry: UserAccessEntry, role: Role) => Promise<void>;
  revokeAccess: (entry: UserAccessEntry) => Promise<void>;
}

export function toEntry(user: ManagedUser): UserAccessEntry {
  const held = user.grants.map((grant) => `${grant.subject}:${grant.action}`);
  return { user, role: roleFromPermissions(held), hasAccess: user.grants.length > 0 };
}

export function useUserAccess(): UserAccessController {
  const { getIdToken } = useAuth();
  const [state, setState] = useState<UserAccessState>({ status: "loading" });
  const [pendingUserIds, setPendingUserIds] = useState<ReadonlySet<string>>(new Set());
  const [failure, setFailure] = useState<UserAccessFailure | null>(null);
  const [attempt, setAttempt] = useState(0); // bumped by retry(), to read the list again

  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);

  const fetchEntries = useCallback(async (): Promise<UserAccessEntry[]> => {
    const token = await getIdToken();
    const users = await UserService.getInstance().getManagedUsers(token);
    return users.map(toEntry);
  }, [getIdToken]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" }); // a retry re-enters loading, so the press is acknowledged

    (async () => {
      try {
        const items = await fetchEntries();
        if (!cancelled) setState({ status: "success", items });
      } catch (error) {
        Sentry.captureException(error);
        if (!cancelled) setState({ status: "error", retry });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchEntries, attempt, retry]);

  const markPending = useCallback((userId: string, pending: boolean) => {
    setPendingUserIds((previous) => {
      const next = new Set(previous);
      if (pending) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }, []);

  /** Writes a change, then re-reads the list so the row never shows stale state. */
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
        // A role is several grants, so a failed change can still have written some. Show what landed.
        try {
          setState({ status: "success", items: await fetchEntries() });
        } catch (refreshError) {
          // The failed change is the more useful message, so keep it on screen.
          Sentry.captureException(refreshError);
        }
        markPending(userId, false);
        return;
      }

      try {
        const items = await fetchEntries();
        setState({ status: "success", items });
      } catch (error) {
        Sentry.captureException(error);
        // The write landed, so keep the list on screen instead of showing a load error.
        setFailure({ kind: "refresh", entry });
      } finally {
        markPending(userId, false);
      }
    },
    [fetchEntries, getIdToken, markPending]
  );

  const grantRole = useCallback(
    (entry: UserAccessEntry, role: Role) =>
      applyChange(entry, "grant", (token) =>
        // No per-institution view yet, so a role covers every institution.
        UserService.getInstance().assignRole(entry.user.user_id, { role, institution_id: ALL_INSTITUTIONS }, token)
      ),
    [applyChange]
  );

  const revokeAccess = useCallback(
    (entry: UserAccessEntry) =>
      applyChange(entry, "revoke", async (token) => {
        const service = UserService.getInstance();
        // Drop every grant (leaving any keeps a page open), in sequence so a refusal stops the rest.
        for (const grant of entry.user.grants) {
          await service.revokePermission(entry.user.user_id, grant.grant_id, token);
        }
      }),
    [applyChange]
  );

  return { state, pendingUserIds, failure, grantRole, revokeAccess };
}
