import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { getAppName, getLogoInverseUrl } from "@/branding/brandingConfig";
import { LanguageSwitcher } from "@/i18n/languageSwitcher/LanguageSwitcher";

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 px-3 py-4 group-data-[collapsible=icon]:px-2">
        <img src={getLogoInverseUrl()} alt={getAppName()} className="h-6 w-auto group-data-[collapsible=icon]:hidden" />
        <span className="font-mono text-[11px] tracking-[2px] text-sidebar-primary uppercase group-data-[collapsible=icon]:hidden">
          {getAppName()}
        </span>
      </SidebarHeader>
      <SidebarContent />
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <LanguageSwitcher />
      </SidebarFooter>
    </Sidebar>
  );
}
