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
import { displayName } from "@/pages/UserAccess/components/AccessRow/AccessRow";
import type { UserAccessEntry } from "@/pages/UserAccess/hooks/useUserAccess";

const uniqueId = "9f13c6a2-84be-4d75-a0e1-52c7b8934fd6";

export const DATA_TEST_ID = {
  CONTAINER: `confirm-access-dialog-container-${uniqueId}`,
  TITLE: `confirm-access-dialog-title-${uniqueId}`,
  DESCRIPTION: `confirm-access-dialog-description-${uniqueId}`,
  CONFIRM: `confirm-access-dialog-confirm-${uniqueId}`,
  CANCEL: `confirm-access-dialog-cancel-${uniqueId}`,
};

export interface ConfirmAccessDialogProps {
  entry: UserAccessEntry | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function ConfirmAccessDialog({ entry, onConfirm, onOpenChange }: Readonly<ConfirmAccessDialogProps>) {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);
  // `entry` clears as the dialog starts closing, so keep the last one to render through the fade-out.
  const lastEntry = useRef(entry);
  if (entry) lastEntry.current = entry;
  const shown = lastEntry.current;

  if (!shown) return null;

  const removing = shown.dashboardGrant !== null;

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
          <DialogDescription data-testid={DATA_TEST_ID.DESCRIPTION}>
            <Trans
              i18nKey={removing ? "userAccess.confirm.revoke.description" : "userAccess.confirm.grant.description"}
              values={{ user: displayName(shown) }}
              components={[<strong key="user" className="font-semibold text-foreground" />]}
            />
          </DialogDescription>
        </DialogHeader>

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
