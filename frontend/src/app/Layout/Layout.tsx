import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AccessGate } from "@/access/AccessContext";
import { FiltersProvider } from "@/filters/FiltersContext";

/** The shell every screen renders inside. Filters wrap the outlet only — the sidebar doesn't use them. */
export const Layout = () => {
  return (
    <AccessGate>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <FiltersProvider>
            <Outlet />
          </FiltersProvider>
        </SidebarInset>
      </SidebarProvider>
    </AccessGate>
  );
};
