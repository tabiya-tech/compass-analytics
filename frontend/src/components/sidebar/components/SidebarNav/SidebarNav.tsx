import type { ComponentType } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Briefcase,
  Building2,
  Compass,
  GraduationCap,
  LayoutGrid,
  MessageCircle,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Action, MODULE_IDS, Subject, useAbility, useAccess, type ModuleId } from "@/access/AccessContext";
import type { AppAbility } from "@/access/ability";
import { modulePath, routerPaths } from "@/app/routerPaths";
import type { TranslationKey } from "@/i18n/react-i18next";

export interface NavPermission {
  action: Action;
  subject: Subject;
}

export interface NavItem {
  id: string;
  labelKey: TranslationKey;
  path: string;
  icon: ComponentType<{ className?: string }>;
  permission?: NavPermission; // absent ⇒ always visible
  requiresMultipleActiveModules?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "overview",
    labelKey: "nav.overview",
    path: routerPaths.ROOT,
    icon: LayoutGrid,
    permission: { action: Action.View, subject: Subject.Dashboard },
  },
  {
    id: "jobseekers",
    labelKey: "nav.jobseekers",
    path: routerPaths.JOBSEEKERS,
    icon: Users,
    permission: { action: Action.View, subject: Subject.Jobseekers },
  },
  {
    id: "institutions",
    labelKey: "nav.institutions",
    path: routerPaths.INSTITUTIONS,
    icon: Building2,
    permission: { action: Action.View, subject: Subject.Institutions },
  },
  {
    id: "access",
    labelKey: "nav.access",
    path: routerPaths.USER_ACCESS,
    icon: ShieldCheck,
    permission: { action: Action.Manage, subject: Subject.AccessManagement },
  },
  {
    id: "modules",
    labelKey: "nav.modules",
    path: routerPaths.MODULES,
    icon: LayoutGrid,
    requiresMultipleActiveModules: true,
  },
];

const MODULE_NAV_LABELS: Record<ModuleId, TranslationKey> = {
  [MODULE_IDS.BUILD_YOUR_PROFILE]: "nav.modulesSection.buildYourProfile",
  [MODULE_IDS.JOB_READINESS]: "nav.modulesSection.jobReadiness",
  [MODULE_IDS.CAREER_EXPLORER]: "nav.modulesSection.careerExplorer",
  [MODULE_IDS.JOBS]: "nav.modulesSection.jobs",
};

const MODULE_NAV_ICONS: Record<ModuleId, ComponentType<{ className?: string }>> = {
  [MODULE_IDS.BUILD_YOUR_PROFILE]: MessageCircle,
  [MODULE_IDS.JOB_READINESS]: GraduationCap,
  [MODULE_IDS.CAREER_EXPLORER]: Compass,
  [MODULE_IDS.JOBS]: Briefcase,
};

export function getVisibleNavItems(
  items: readonly NavItem[],
  ability: AppAbility,
  activeModules: readonly ModuleId[]
): NavItem[] {
  return items.filter((item) => {
    if (item.requiresMultipleActiveModules) return activeModules.length > 1;
    if (item.permission) return ability.can(item.permission.action, item.permission.subject);
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
    labelKey: MODULE_NAV_LABELS[id],
    path: modulePath(id),
    icon: MODULE_NAV_ICONS[id],
  }));
}

export function SidebarNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const ability = useAbility<AppAbility>();
  const { activeModules } = useAccess();

  const visibleItems = getVisibleNavItems(NAV_ITEMS, ability, activeModules);
  const moduleSubItems = getModuleSubItems(activeModules);

  return (
    <SidebarGroup>
      <SidebarMenu className="group-data-[collapsible=icon]:gap-3">
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
                className="gap-3 rounded-sm px-3 py-5 text-sm font-medium text-sidebar-foreground/70 [&>svg]:size-5 group-data-[collapsible=icon]:p-1.5!"
              >
                <NavLink to={item.path} end={item.path === routerPaths.ROOT}>
                  <Icon />
                  <span>{t(item.labelKey)}</span>
                </NavLink>
              </SidebarMenuButton>

              {isModules && moduleSubItems.length > 0 && (
                <SidebarMenuSub className="mx-0 border-l-0 px-0 pl-8 pt-1">
                  {moduleSubItems.map((subItem) => {
                    const SubIcon = subItem.icon;
                    return (
                      <SidebarMenuSubItem key={subItem.id}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={location.pathname === subItem.path}
                          className="gap-3 rounded-sm px-3.5 py-4 text-sm text-sidebar-foreground/70"
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
