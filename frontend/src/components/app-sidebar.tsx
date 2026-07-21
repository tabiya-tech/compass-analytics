import { Sidebar, SidebarContent, SidebarHeader } from "@/components/ui/sidebar";

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 px-3 py-4 group-data-[collapsible=icon]:px-2">
        <img
          src="/logos/tabiya-logo-white.svg"
          alt="Tabiya"
          className="h-6 w-auto group-data-[collapsible=icon]:hidden"
        />
        <span className="font-mono text-[11px] tracking-[2px] text-sidebar-primary uppercase group-data-[collapsible=icon]:hidden">
          Compass Analytics
        </span>
      </SidebarHeader>
      <SidebarContent />
    </Sidebar>
  );
}
