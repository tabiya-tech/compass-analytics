import { describe, expect, it } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AccessProvider } from "@/access/AccessContext";

describe("AppSidebar", () => {
  it("renders the Compass Analytics brand mark", () => {
    render(
      <AccessProvider>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </AccessProvider>
    );

    expect(screen.getByText("Compass Analytics")).toBeInTheDocument();
    expect(screen.getByAltText("Compass Analytics")).toBeInTheDocument();
  });
});
