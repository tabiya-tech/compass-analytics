import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

describe("AppSidebar", () => {
  it("renders the Compass Analytics brand mark", () => {
    render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    );

    expect(screen.getByText("Compass Analytics")).toBeInTheDocument();
    expect(screen.getByAltText("Tabiya")).toBeInTheDocument();
  });
});
