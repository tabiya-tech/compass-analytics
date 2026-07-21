import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { HomePage } from "@/pages/HomePage";

function App() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <HomePage />
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
