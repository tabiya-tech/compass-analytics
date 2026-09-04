import { createContext, useContext, useMemo, type ReactNode } from "react";
import { AbilityProvider, Can, useAbility } from "@casl/react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useMe } from "@/user/useMe";
import { Action, buildAbility, Subject, type AppAbility } from "@/access/ability";
import { AccessErrorPage } from "@/access/AccessErrorPage";
import type { MeResponse, ModuleId } from "@/user/user.types";

export { Can, useAbility, Subject, Action };
export type { AppAbility, ModuleId };

export const MODULE_IDS = {
  BUILD_YOUR_PROFILE: "build-your-profile",
  JOB_READINESS: "job-readiness",
  CAREER_EXPLORER: "career-explorer",
  JOBS: "jobs",
} as const;

// null = deployment-wide (no filter); [] = no access; ["inst-a", ...] = scoped to those institutions.
export type AccessScope = { institutionIds: string[] | null };

export function coversMultipleInstitutions(scope: AccessScope): boolean {
  return scope.institutionIds === null || scope.institutionIds.length > 1;
}

export interface AccessContextValue {
  scope: AccessScope;
  activeModules: readonly ModuleId[];
  isMultiInstitution: boolean;
  role: string | null;
  /**
   * The backend's record of the caller's name — set at first login from the ID token's `name`
   * claim, independent of the client's own copy. A screen should still prefer the live Firebase
   * `user.displayName` and fall back to this, since this can lag a just-changed profile.
   */
  name: string | null;
  /** From the backend record — organization isn't part of Firebase identity, so there is no other copy of it. */
  organization: string | null;
}

export interface AccessProviderProps {
  ability?: AppAbility;
  scope?: AccessScope;
  activeModules?: readonly ModuleId[];
  role?: string | null;
  name?: string | null;
  organization?: string | null;
}

const DEFAULT_ABILITY: AppAbility = buildAbility([]);
const DEFAULT_SCOPE: AccessScope = { institutionIds: [] };
const DEFAULT_MODULES: readonly ModuleId[] = Object.values(MODULE_IDS);

const AccessContext = createContext<AccessContextValue | null>(null);

export function useAccess(): AccessContextValue {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error("useAccess must be used within an AccessProvider.");
  return ctx;
}

/**
 * Provides CASL ability (via AbilityProvider) and scope/module state (via AccessContext).
 * Use `Can` / `useAbility` for permission checks; `useAccess` for scope and active modules.
 * Tests and stories pass props directly; AccessGate wires /api/me in production.
 */
export function AccessProvider({
  children,
  ability,
  scope,
  activeModules,
  role = null,
  name = null,
  organization = null,
}: Readonly<{ children: ReactNode } & AccessProviderProps>) {
  const resolvedAbility = ability ?? DEFAULT_ABILITY;
  const resolvedScope = scope ?? DEFAULT_SCOPE;
  const resolvedModules = activeModules ?? DEFAULT_MODULES;

  const value = useMemo<AccessContextValue>(
    () => ({
      scope: resolvedScope,
      activeModules: resolvedModules,
      isMultiInstitution: coversMultipleInstitutions(resolvedScope),
      role,
      name,
      organization,
    }),
    [resolvedScope, resolvedModules, role, name, organization]
  );

  return (
    <AbilityProvider value={resolvedAbility}>
      <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
    </AbilityProvider>
  );
}

function _buildScope(me: MeResponse): AccessScope {
  return { institutionIds: me.scope.institution_ids };
}

/**
 * App-facing provider: fetches /api/me, builds the CASL ability from the
 * returned permissions, and hydrates AccessProvider. Blocks children until
 * the fetch settles so no screen renders against stale defaults.
 */
export function AccessGate({ children }: Readonly<{ children: ReactNode }>) {
  const me = useMe();
  const { t } = useTranslation();

  if (me.status === "loading")
    return (
      <div
        role="status"
        aria-label={t("access.loading")}
        className="flex min-h-screen items-center justify-center bg-background"
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  // Not signed in — render children with no ability so ProtectedRoute redirects to login.
  if (me.status === "unauthenticated") return <AccessProvider ability={buildAbility([])}>{children}</AccessProvider>;
  if (me.status === "unprovisioned") return <AccessErrorPage variant="unprovisioned" />;
  if (me.status === "error") return <AccessErrorPage variant="error" />;

  return (
    <AccessProvider
      ability={buildAbility(me.data.permissions)}
      scope={_buildScope(me.data)}
      activeModules={me.data.active_modules}
      role={me.data.role}
      name={me.data.name}
      organization={me.data.organization}
    >
      {children}
    </AccessProvider>
  );
}
