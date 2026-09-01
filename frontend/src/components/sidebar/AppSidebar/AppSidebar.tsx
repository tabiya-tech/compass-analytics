import { useNavigate } from "react-router-dom";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import { getAppName, getLogoInverseUrl } from "@/branding/branding";
import { SidebarNav } from "@/components/sidebar/components/SidebarNav";
import { SidebarToggle } from "@/components/sidebar/components/SidebarToggle";
import { SidebarUserMenu } from "@/components/sidebar/components/SidebarUserMenu";
import { AuthenticationServiceFactory } from "@/auth/services/Authentication.service.factory";
import { routerPaths } from "@/app/routerPaths";
import { cn } from "@/lib/utils";

const AppSidebarHeader = () => {
  const isCollapsed = useSidebar().state === "collapsed";

  return (
    <SidebarHeader className={cn("gap-3 pt-6 pb-4", isCollapsed ? "px-2" : "px-5")}>
      <div className={cn("flex items-center gap-2", isCollapsed ? "justify-center" : "justify-between")}>
        {!isCollapsed && <img src={getLogoInverseUrl()} alt={getAppName()} className="h-6" />}
        <SidebarToggle className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
      </div>
      {!isCollapsed && (
        <span className="font-mono text-[12px] tracking-[2px] text-sidebar-primary uppercase">{getAppName()}</span>
      )}
    </SidebarHeader>
  );
};

export function AppSidebar() {
  const navigate = useNavigate();

  const handleSignOut = () => {
    AuthenticationServiceFactory.getCurrentAuthenticationService().logout();
    navigate(routerPaths.LOGIN);
  };

  return (
    <Sidebar collapsible="icon">
      <AppSidebarHeader />
      <SidebarContent>
        <SidebarNav />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border pt-3">
        <SidebarUserMenu onSignOut={handleSignOut} />
      </SidebarFooter>
    </Sidebar>
  );
}
