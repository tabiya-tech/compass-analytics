import { useNavigate } from "react-router-dom";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { getAppName, getLogoInverseUrl } from "@/branding/brandingConfig";
import { SidebarNav } from "@/components/sidebar/components/sidebar-nav";
import { SidebarUserMenu } from "@/components/sidebar/components/sidebar-user-menu";
import { AuthenticationServiceFactory } from "@/auth/services/Authentication.service.factory";
import { routerPaths } from "@/app/routerPaths";

export function AppSidebar() {
  const navigate = useNavigate();

  const handleSignOut = () => {
    AuthenticationServiceFactory.getCurrentAuthenticationService().logout();
    navigate(routerPaths.LOGIN);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="items-start gap-4 px-3 pt-8 pb-4 group-data-[collapsible=icon]:px-2">
        <img src={getLogoInverseUrl()} alt={getAppName()} className="h-6 group-data-[collapsible=icon]:hidden" />
        <span className="font-mono text-[11px] tracking-[2px] text-sidebar-primary uppercase group-data-[collapsible=icon]:hidden">
          {getAppName()}
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarNav />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border pt-3">
        <SidebarUserMenu onSignOut={handleSignOut} />
      </SidebarFooter>
    </Sidebar>
  );
}
