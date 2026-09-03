import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { routerPaths } from "@/app/routerPaths";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useAuth } from "@/auth/AuthContext";
import { useAccess } from "@/access/AccessContext";

export function SidebarUserMenu({ onSignOut }: Readonly<{ onSignOut: () => void }>) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { role, name: nameOnBackendRecord } = useAccess();
  const displayedName = user?.displayName ?? nameOnBackendRecord ?? t("common.myAccount");
  const displayedRoleLabel = role ?? t("common.unknown");

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" aria-label={t("nav.userMenu.trigger")} className="px-3">
              <UserAvatar name={displayedName} className="bg-tabiya-green text-tabiya-blue" />
              <span className="grid min-w-0 flex-1 text-left">
                <span className="truncate font-medium">{displayedName}</span>
                <span className="truncate text-xs text-sidebar-foreground/60">{displayedRoleLabel}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 border-tabiya-blue/15"
          >
            <DropdownMenuItem asChild>
              <Link to={routerPaths.SETTINGS}>{t("nav.userMenu.accountSettings")}</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onSignOut}>
              {t("auth.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
