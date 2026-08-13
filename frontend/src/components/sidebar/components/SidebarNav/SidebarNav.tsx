import type { ComponentType } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Building2, LayoutGrid, Users } from "lucide-react";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { PERMISSIONS, useAccess, type ModuleId, type PermissionKey } from "@/access/AccessContext";
import { MODULE_ICONS, MODULE_LABEL_KEYS } from "@/access/moduleDisplay";
import { modulePath, routerPaths } from "@/app/routerPaths";
import type { TranslationKey } from "@/i18n/react-i18next";

export interface NavItem {
  id: string;
  labelKey: TranslationKey;
  path: string;
  icon: ComponentType<{ className?: string }>;
  permission?: PermissionKey; // absent ⇒ always visible
  requiresMultipleActiveModules?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "overview",
    labelKey: "nav.overview",
    path: routerPaths.ROOT,
    icon: LayoutGrid,
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    id: "institutions",
    labelKey: "nav.institutions",
    path: routerPaths.INSTITUTIONS,
    icon: Building2,
    permission: PERMISSIONS.INSTITUTIONS_VIEW,
  },
  {
    id: "jobseekers",
    labelKey: "nav.jobseekers",
    path: routerPaths.JOBSEEKERS,
    icon: Users,
    permission: PERMISSIONS.JOBSEEKERS_VIEW,
  },
  {
    id: "modules",
    labelKey: "nav.modules",
    path: routerPaths.MODULES,
    icon: LayoutGrid,
    requiresMultipleActiveModules: true,
  },
];

export interface NavVisibilityContext {
  hasPermission: (permission: PermissionKey) => boolean;
  activeModules: readonly ModuleId[];
}

export function getVisibleNavItems(items: readonly NavItem[], ctx: NavVisibilityContext): NavItem[] {
  return items.filter((item) => {
    if (item.requiresMultipleActiveModules) return ctx.activeModules.length > 1;
    if (item.permission) return ctx.hasPermission(item.permission);
    return true;
  });
}

export interface ModuleSubItem {
  id: ModuleId;
  labelKey: TranslationKey;
  path: string;
  icon: ComponentType<{ className?: string }>;
}

export function getModuleSubItems(activeModules: readonly ModuleId[]): ModuleSubItem[] {
  return activeModules.map((id) => ({
    id,
    labelKey: MODULE_LABEL_KEYS[id],
    path: modulePath(id),
    icon: MODULE_ICONS[id],
  }));
}

export function SidebarNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const access = useAccess();

  const visibleItems = getVisibleNavItems(NAV_ITEMS, access);
  const moduleSubItems = getModuleSubItems(access.activeModules);

  return (
    <SidebarGroup>
      <SidebarMenu>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isModules = item.id === "modules";
          // Exact match, so an active submodule doesn't also light up "Modules".
          const isActive = location.pathname === item.path;

          return (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={t(item.labelKey)}
                className="h-11 gap-3 px-3 text-sm font-medium text-sidebar-foreground/70 [&>svg]:size-5"
              >
                <NavLink to={item.path} end={item.path === routerPaths.ROOT}>
                  <Icon />
                  <span>{t(item.labelKey)}</span>
                </NavLink>
              </SidebarMenuButton>

              {isModules && moduleSubItems.length > 0 && (
                <SidebarMenuSub className="mx-0 border-l-0 px-0 pl-8">
                  {moduleSubItems.map((subItem) => {
                    const SubIcon = subItem.icon;
                    return (
                      <SidebarMenuSubItem key={subItem.id}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={location.pathname === subItem.path}
                          className="h-10 gap-2.5 px-2 text-sm text-sidebar-foreground/70 [&>svg]:text-current"
                        >
                          <NavLink to={subItem.path}>
                            <SubIcon />
                            <span>{t(subItem.labelKey)}</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
