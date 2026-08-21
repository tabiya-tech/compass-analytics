import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import { AccessProvider } from "@/access/AccessContext";
import { AuthProvider } from "@/auth/AuthContext";
import { Toaster } from "@/components/ui/sonner";

// Session-wide providers only. Filter tests mount their own FiltersProvider, with a fixed date.
export const AllTheProviders = ({ children }: Readonly<{ children: ReactNode }>) => {
  return (
    <AuthProvider>
      <AccessProvider>
        <HashRouter>
          {children}
          <Toaster />
        </HashRouter>
      </AccessProvider>
    </AuthProvider>
  );
};

function render(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return rtlRender(ui, { wrapper: AllTheProviders, ...options });
}

export * from "@testing-library/react";
export * from "@testing-library/user-event";
export { render };
