import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { ScreenHead } from "@/components/shared/ScreenHead";
import { DEFAULT_ASSIGNABLE_ROLE, isInstitutionScoped, type Role } from "@/access/roles";
import { AccessRow } from "@/pages/UserAccess/components/AccessRow";
import { displayName } from "@/pages/UserAccess/components/AccessRow/AccessRow";
import { ConfirmAccessDialog } from "@/pages/UserAccess/components/ConfirmAccessDialog";
import { UserAccessSkeleton } from "@/pages/UserAccess/components/UserAccessSkeleton";
import { useInstitutionChoices } from "@/pages/UserAccess/hooks/useInstitutionChoices";
import { useUserAccess, type UserAccessEntry, type UserAccessFailure } from "@/pages/UserAccess/hooks/useUserAccess";
import { ALL_INSTITUTIONS } from "@/user/user.types";

const uniqueId = "e7c04a19-3b58-42df-90ac-6d1f8b25e743";

export const DATA_TEST_ID = {
  CONTAINER: `user-access-container-${uniqueId}`,
  LIST: `user-access-list-${uniqueId}`,
  ERROR: `user-access-error-${uniqueId}`,
  FAILURE: `user-access-failure-${uniqueId}`,
};

type Translate = ReturnType<typeof useTranslation>["t"];

function failureMessage(t: Translate, reported: UserAccessFailure): string {
  return reported.kind === "refresh"
    ? t("userAccess.failure.refresh")
    : t(reported.kind === "grant" ? "userAccess.failure.grant" : "userAccess.failure.revoke", {
        user: displayName(reported.entry),
      });
}

export function UserAccess() {
  const { t } = useTranslation();
  const { state, pendingUserIds, failure, grantRole, revokeAccess } = useUserAccess();
  const institutions = useInstitutionChoices();
  const [confirming, setConfirming] = useState<UserAccessEntry | null>(null);
  const [role, setRole] = useState<Role>(DEFAULT_ASSIGNABLE_ROLE);
  const [institutionId, setInstitutionId] = useState<string | null>(null);

  // A role that is not institution-scoped covers the deployment; one that is waits for a pick.
  const scope = isInstitutionScoped(role) ? institutionId : ALL_INSTITUTIONS;

  const startConfirming = (entry: UserAccessEntry) => {
    // Reset, so a role picked for one user is not carried to the next.
    setRole(DEFAULT_ASSIGNABLE_ROLE);
    setInstitutionId(null);
    setConfirming(entry);
  };

  const changeRole = (picked: Role) => {
    setRole(picked);
    // The institution was chosen for the previous role, so don't carry it across the change.
    setInstitutionId(null);
  };

  const confirmChange = () => {
    if (!confirming) return;
    if (confirming.hasAccess) void revokeAccess(confirming);
    // The dialog holds the confirmation until an institution-scoped role has one, so `scope` is set.
    else if (scope) void grantRole(confirming, role, scope);
    setConfirming(null);
  };

  // Show a toast for any failure, even if the list is re-read successfully afterward.
  useEffect(() => {
    if (!failure) return;
    toast.error(failureMessage(t, failure), {
      id: `${failure.kind}-${failure.entry.user.user_id}`,
      testId: DATA_TEST_ID.FAILURE,
    });
  }, [failure, t]);

  return (
    <div className="flex h-svh min-w-0 flex-col gap-6 px-8 py-6 pb-8" data-testid={DATA_TEST_ID.CONTAINER}>
      <ScreenHead
        eyebrow={t("userAccess.eyebrow")}
        title={t("userAccess.title")}
        description={t("userAccess.description")}
      />

      {state.status === "loading" && <UserAccessSkeleton />}

      {state.status === "error" && (
        <div data-testid={DATA_TEST_ID.ERROR}>
          <EmptyState
            icon={<TriangleAlert />}
            message={t("userAccess.error")}
            action={{ label: t("common.retry"), onClick: state.retry }}
          />
        </div>
      )}

      {state.status === "success" &&
        (state.items.length === 0 ? (
          <EmptyState message={t("userAccess.empty")} className="rounded-card border bg-card" />
        ) : (
          <ul
            data-testid={DATA_TEST_ID.LIST}
            aria-label={t("userAccess.listLabel")}
            className="grid min-h-0 min-w-0 flex-1 auto-rows-max gap-3 overflow-y-auto rounded-card border bg-card p-4"
          >
            {state.items.map((entry) => (
              <AccessRow
                key={entry.user.user_id}
                entry={entry}
                pending={pendingUserIds.has(entry.user.user_id)}
                onToggle={startConfirming}
              />
            ))}
          </ul>
        ))}

      <ConfirmAccessDialog
        entry={confirming}
        role={role}
        onRoleChange={changeRole}
        institutions={institutions}
        institutionId={institutionId}
        onInstitutionChange={setInstitutionId}
        onConfirm={confirmChange}
        onOpenChange={(open) => !open && setConfirming(null)}
      />
    </div>
  );
}
