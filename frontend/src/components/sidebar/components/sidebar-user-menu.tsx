import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronsUpDown, CircleUser } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { routerPaths } from "@/app/routerPaths";

export function SidebarUserMenu({ onSignOut }: Readonly<{ onSignOut: () => void }>) {
  const { t } = useTranslation();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" aria-label={t("nav.userMenu.trigger")}>
              <Avatar className="size-8 rounded-full">
                <AvatarFallback className="rounded-full bg-tabiya-green text-tabiya-blue">
                  <CircleUser className="size-4" />
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate text-left font-medium">{t("nav.userMenu.label")}</span>
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
