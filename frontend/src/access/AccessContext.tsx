import { createContext, useContext, useMemo, type ReactNode } from "react";
import { AbilityProvider, Can, useAbility } from "@casl/react";
import { useTranslation } from "react-i18next";
import { useMe } from "@/user/useMe";
import { Action, buildAbility, Subject, type AppAbility } from "@/access/ability";
import type { MeResponse, ModuleId } from "@/user/user.types";

export { Can, useAbility, Subject, Action };
export type { AppAbility, ModuleId };

export const MODULE_IDS = {
  BUILD_YOUR_PROFILE: "build-your-profile",
  JOB_READINESS: "job-readiness",
  CAREER_EXPLORER: "career-explorer",
  JOBS: "jobs",
} as const;

export type AccessScope = { type: "all" } | { type: "institutions"; institutionIds: string[] };

export function coversMultipleInstitutions(scope: AccessScope): boolean {
  return scope.type === "all" || (scope.type === "institutions" && scope.institutionIds.length > 1);
}

export interface AccessContextValue {
  scope: AccessScope;
  activeModules: readonly ModuleId[];
  isMultiInstitution: boolean;
}

export interface AccessProviderProps {
  ability?: AppAbility;
  scope?: AccessScope;
  activeModules?: readonly ModuleId[];
}

const DEFAULT_ABILITY: AppAbility = buildAbility(
  Object.values(Subject).flatMap((subject) => Object.values(Action).map((action) => `${subject}:${action}`))
);
const DEFAULT_SCOPE: AccessScope = { type: "institutions", institutionIds: ["inst-1"] };
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
export function AccessProvider({ children, ability, scope, activeModules }: Readonly<{ children: ReactNode } & AccessProviderProps>) {
  const resolvedAbility = ability ?? DEFAULT_ABILITY;
  const resolvedScope = scope ?? DEFAULT_SCOPE;
  const resolvedModules = activeModules ?? DEFAULT_MODULES;

  const value = useMemo<AccessContextValue>(
    () => ({
      scope: resolvedScope,
      activeModules: resolvedModules,
      isMultiInstitution: coversMultipleInstitutions(resolvedScope),
    }),
    [resolvedScope, resolvedModules]
  );

  return (
    <AbilityProvider value={resolvedAbility}>
      <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
    </AbilityProvider>
  );
}

function _buildScope(me: MeResponse): AccessScope {
  return me.scope.type === "all"
    ? { type: "all" }
    : { type: "institutions", institutionIds: me.scope.institution_ids };
}

/**
 * App-facing provider: fetches /api/me, builds the CASL ability from the
 * returned permissions, and hydrates AccessProvider. Blocks children until
 * the fetch settles so no screen renders against stale defaults.
 */
export function AccessGate({ children }: Readonly<{ children: ReactNode }>) {
  const me = useMe();
  const { t } = useTranslation();

  if (me.status === "loading") return <div role="status">{t("access.loading")}</div>;
  if (me.status === "unprovisioned") return <div role="alert">{t("access.unprovisioned")}</div>;
  if (me.status === "error") return <div role="alert">{t("access.error")}</div>;

  return (
    <AccessProvider
      ability={buildAbility(me.data.permissions)}
      scope={_buildScope(me.data)}
      activeModules={me.data.active_modules}
    >
      {children}
    </AccessProvider>
  );
}
