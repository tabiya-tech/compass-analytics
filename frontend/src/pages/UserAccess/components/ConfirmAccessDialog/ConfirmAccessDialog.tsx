import { useRef } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { displayName } from "@/pages/UserAccess/components/AccessRow/AccessRow";
import type { InstitutionChoicesState } from "@/pages/UserAccess/hooks/useInstitutionChoices";
import type { UserAccessEntry } from "@/pages/UserAccess/hooks/useUserAccess";
import type { RoleRecord } from "@/user/user.types";

const uniqueId = "9f13c6a2-84be-4d75-a0e1-52c7b8934fd6";

export const DATA_TEST_ID = {
  CONTAINER: `confirm-access-dialog-container-${uniqueId}`,
  TITLE: `confirm-access-dialog-title-${uniqueId}`,
  DESCRIPTION: `confirm-access-dialog-description-${uniqueId}`,
  ROLE_SELECT: `confirm-access-dialog-role-select-${uniqueId}`,
  ROLE_HINT: `confirm-access-dialog-role-hint-${uniqueId}`,
  INSTITUTION_FIELD: `confirm-access-dialog-institution-field-${uniqueId}`,
  INSTITUTION_SELECT: `confirm-access-dialog-institution-select-${uniqueId}`,
  INSTITUTION_HINT: `confirm-access-dialog-institution-hint-${uniqueId}`,
  INSTITUTION_ERROR: `confirm-access-dialog-institution-error-${uniqueId}`,
  CONFIRM: `confirm-access-dialog-confirm-${uniqueId}`,
  CANCEL: `confirm-access-dialog-cancel-${uniqueId}`,
};

const ROLE_FIELD_ID = `confirm-access-dialog-role-${uniqueId}`;
const INSTITUTION_FIELD_ID = `confirm-access-dialog-institution-${uniqueId}`;

export interface ConfirmAccessDialogProps {
  entry: UserAccessEntry | null;
  /** Assignable roles fetched from the API. */
  roles: readonly RoleRecord[];
  selectedRole: RoleRecord | null;
  onRoleChange: (role: RoleRecord) => void;
  /** The institutions an institution-scoped role can be given at, and how that fetch is going. */
  institutions: InstitutionChoicesState;
  /** The institution picked for the role, or null while none has been. */
  institutionId: string | null;
  onInstitutionChange: (institutionId: string) => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function ConfirmAccessDialog({
  entry,
  roles,
  selectedRole,
  onRoleChange,
  institutions,
  institutionId,
  onInstitutionChange,
  onConfirm,
  onOpenChange,
}: Readonly<ConfirmAccessDialogProps>) {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);
  // `entry` clears as the dialog starts closing, so keep the last one to render through the fade-out.
  const lastEntry = useRef(entry);
  if (entry) lastEntry.current = entry;
  const shown = lastEntry.current;

  if (!shown) return null;

  const removing = shown.hasAccess;
  const blocked = false;

  return (
    <Dialog open={entry !== null} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
        data-testid={DATA_TEST_ID.CONTAINER}
        className="gap-6 sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle data-testid={DATA_TEST_ID.TITLE} className="text-xl">
            {t(removing ? "userAccess.confirm.revoke.title" : "userAccess.confirm.grant.title")}
          </DialogTitle>
          {/* asChild: a removal adds a second paragraph, and Radix's own Description element is a <p>. */}
          <DialogDescription data-testid={DATA_TEST_ID.DESCRIPTION} asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <Trans
                  i18nKey={removing ? "userAccess.confirm.revoke.description" : "userAccess.confirm.grant.description"}
                  values={{ user: displayName(shown) }}
                  components={[<strong key="user" className="font-semibold text-foreground" />]}
                />
              </p>
              {removing && <p>{t("userAccess.confirm.revoke.detail")}</p>}
            </div>
          </DialogDescription>
        </DialogHeader>

        {!removing && (
          <div className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor={ROLE_FIELD_ID} className="text-sm font-semibold">
                {t("userAccess.confirm.grant.roleLabel")}
              </Label>
              <Select value={selectedRole?._id ?? ""} onValueChange={(id) => { const picked = roles.find((r) => r._id === id); if (picked) onRoleChange(picked); }}>
                <SelectTrigger
                  id={ROLE_FIELD_ID}
                  data-testid={DATA_TEST_ID.ROLE_SELECT}
                  className="h-11 w-full rounded-md text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.filter((r) => r.assignable).map((r) => (
                    <SelectItem key={r._id} value={r._id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRole && (
                <p data-testid={DATA_TEST_ID.ROLE_HINT} className="text-sm text-muted-foreground">
                  {selectedRole.description}
                </p>
              )}
            </div>

            <div className="grid gap-2" data-testid={DATA_TEST_ID.INSTITUTION_FIELD}>
                <Label htmlFor={INSTITUTION_FIELD_ID} className="text-sm font-semibold">
                  {t("userAccess.confirm.grant.institutionLabel")}
                </Label>
                <Select
                  value={institutionId ?? undefined}
                  onValueChange={onInstitutionChange}
                  disabled={institutions.status !== "success"}
                >
                  <SelectTrigger
                    id={INSTITUTION_FIELD_ID}
                    data-testid={DATA_TEST_ID.INSTITUTION_SELECT}
                    className="h-11 w-full rounded-md text-sm"
                  >
                    <SelectValue
                      placeholder={t(
                        institutions.status === "loading"
                          ? "userAccess.confirm.grant.institutionLoading"
                          : "userAccess.confirm.grant.institutionPlaceholder"
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {institutions.status === "success" &&
                      institutions.items.map((institution) => (
                        <SelectItem key={institution.id} value={institution.id}>
                          {institution.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {institutions.status === "error" ? (
                  <p data-testid={DATA_TEST_ID.INSTITUTION_ERROR} className="text-sm text-destructive">
                    {t("userAccess.confirm.grant.institutionError")}
                  </p>
                ) : (
                  <p data-testid={DATA_TEST_ID.INSTITUTION_HINT} className="text-sm text-muted-foreground">
                    {t("userAccess.confirm.grant.institutionHint")}
                  </p>
                )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid={DATA_TEST_ID.CANCEL}
            className="h-11 cursor-pointer rounded-pill px-6 text-sm font-semibold hover:bg-muted hover:text-foreground"
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant={removing ? "destructive" : "brand"}
            onClick={onConfirm}
            disabled={blocked}
            data-testid={DATA_TEST_ID.CONFIRM}
            className="h-11 cursor-pointer rounded-pill px-6 text-sm font-semibold"
          >
            {t(removing ? "userAccess.confirm.revoke.action" : "userAccess.confirm.grant.action")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
