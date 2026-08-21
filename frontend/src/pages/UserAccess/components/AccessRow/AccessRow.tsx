import { useTranslation } from "react-i18next";
import { Check, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL_KEYS } from "@/access/roles";
import type { UserAccessEntry } from "@/pages/UserAccess/hooks/useUserAccess";
import { cn } from "@/lib/utils";

const uniqueId = "4d8b21c7-6e35-4a90-b1f2-7c0d9e563a48";

export const DATA_TEST_ID = {
  CONTAINER: `access-row-container-${uniqueId}`,
  USER: `access-row-user-${uniqueId}`,
  DETAIL: `access-row-detail-${uniqueId}`,
  TOGGLE: `access-row-toggle-${uniqueId}`,
};

/** name and email are both nullable and can come back empty, so fall back rather than render blank. */
export function displayName(entry: UserAccessEntry): string {
  return entry.user.name || entry.user.email || entry.user.user_id;
}

export interface AccessRowProps {
  entry: UserAccessEntry;
  onToggle: (entry: UserAccessEntry) => void;
  pending?: boolean;
  className?: string;
}

export function AccessRow({ entry, onToggle, pending = false, className }: Readonly<AccessRowProps>) {
  const { t } = useTranslation();
  const { role, hasAccess } = entry;
  const name = displayName(entry);

  // Grants matching no known role: say so rather than name a role they do not hold.
  const access = role ? t(ROLE_LABEL_KEYS[role]) : t(hasAccess ? "userAccess.row.otherAccess" : "userAccess.row.none");
  const detail = entry.user.name && entry.user.email ? `${entry.user.email} · ${access}` : access;

  return (
    <li
      data-testid={DATA_TEST_ID.CONTAINER}
      data-granted={hasAccess}
      className={cn("flex flex-wrap items-center justify-between gap-4 rounded-card bg-muted px-5 py-4", className)}
    >
      <div className="flex min-w-0 items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tabiya-blue text-white [&_svg]:size-5"
        >
          <UserRound />
        </span>
        <span className="min-w-0">
          <span data-testid={DATA_TEST_ID.USER} className="block truncate font-semibold text-foreground">
            {name}
          </span>
          <span data-testid={DATA_TEST_ID.DETAIL} className="block truncate text-sm text-muted-foreground">
            {detail}
          </span>
        </span>
      </div>

      <Button
        type="button"
        variant={hasAccess ? "brand" : "outline"}
        aria-pressed={hasAccess}
        disabled={pending}
        onClick={() => onToggle(entry)}
        data-testid={DATA_TEST_ID.TOGGLE}
        // The visible label repeats down the list, so name the button after the user.
        aria-label={t(hasAccess ? "userAccess.toggle.grantedLabel" : "userAccess.toggle.grantLabel", { user: name })}
        className={cn(
          "h-11 min-w-[190px] cursor-pointer rounded-pill px-6 text-sm font-semibold",
          // Granted keeps the brand variant's lighter green. The outline variant would hover to
          // bg-accent — Tabiya Green, the granted look — so tint it with its own blue instead.
          !hasAccess && "border-tabiya-blue hover:bg-tabiya-blue/10"
        )}
      >
        {hasAccess ? <Check /> : <Plus />}
        {t(hasAccess ? "userAccess.toggle.granted" : "userAccess.toggle.grant")}
      </Button>
    </li>
  );
}
