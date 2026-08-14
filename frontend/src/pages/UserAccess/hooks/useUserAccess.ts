import { useCallback, useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/react";
import { useAuth } from "@/auth/AuthContext";
import { Action, Subject } from "@/access/AccessContext";
import { UserService } from "@/user/User.service";
import type { GrantView, ManagedUser } from "@/user/user.types";

export interface UserAccessEntry {
  user: ManagedUser;
  /** The institution a grant would be scoped to; null when nothing names one unambiguously. */
  institutionId: string | null;
  dashboardGrant: GrantView | null;
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
  toggleAccess: (entry: UserAccessEntry) => Promise<void>;
}

export function toEntry(user: ManagedUser): UserAccessEntry {
  const dashboardGrant =
    user.grants.find((grant) => grant.subject === Subject.Dashboard && grant.action === Action.View) ?? null;
  // The dashboard grant's own scope wins; without one, a new grant can only be scoped where the
  // rest of their grants agree.
  const scopes = new Set(user.grants.map((grant) => grant.institution_id));
  const institutionId = dashboardGrant?.institution_id ?? (scopes.size === 1 ? [...scopes][0] : null);

  return { user, institutionId, dashboardGrant };
}

export function useUserAccess(): UserAccessController {
  const { getIdToken } = useAuth();
  const [state, setState] = useState<UserAccessState>({ status: "loading" });
  const [pendingUserIds, setPendingUserIds] = useState<ReadonlySet<string>>(new Set());
  const [failure, setFailure] = useState<UserAccessFailure | null>(null);
  const [attempt, setAttempt] = useState(0); // bumped by retry(), to read the list again

  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);

  // The institution a grant would be scoped to is not part of the user record, so remember it across re-reads.
  const knownInstitutions = useRef(new Map<string, string>());

  const fetchEntries = useCallback(async (): Promise<UserAccessEntry[]> => {
    const token = await getIdToken();
    const users = await UserService.getInstance().getManagedUsers(token);

    return users.map(toEntry).map((entry) => {
      const { user_id: userId } = entry.user;
      if (entry.institutionId !== null) {
        knownInstitutions.current.set(userId, entry.institutionId);
        return entry;
      }
      const remembered = knownInstitutions.current.get(userId);
      return remembered === undefined ? entry : { ...entry, institutionId: remembered };
    });
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

  const toggleAccess = useCallback(
    async (entry: UserAccessEntry) => {
      const { user_id: userId } = entry.user;
      const { dashboardGrant, institutionId } = entry;
      // The row's control is disabled without an institution; this only guards a stray call.
      if (!dashboardGrant && !institutionId) return;

      markPending(userId, true);
      setFailure(null);

      try {
        const token = await getIdToken();
        const service = UserService.getInstance();

        if (dashboardGrant) {
          await service.revokePermission(userId, dashboardGrant.grant_id, token);
        } else {
          await service.grantPermission(
            userId,
            { subject: Subject.Dashboard, action: Action.View, institution_id: institutionId! },
            token
          );
        }
      } catch (error) {
        Sentry.captureException(error);
        setFailure({ kind: dashboardGrant ? "revoke" : "grant", entry });
        markPending(userId, false);
        return;
      }

      try {
        // Re-read before the row leaves pending, so it never offers its stale pre-change state.
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

  return { state, pendingUserIds, failure, toggleAccess };
}
