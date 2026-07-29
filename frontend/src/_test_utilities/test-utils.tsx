import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import { AccessProvider } from "@/access/AccessContext";

// Session-wide providers only. Filter tests mount their own FiltersProvider, with a fixed date.
export const AllTheProviders = ({ children }: Readonly<{ children: ReactNode }>) => {
  return (
    <AccessProvider>
      <HashRouter>{children}</HashRouter>
    </AccessProvider>
  );
};

function render(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return rtlRender(ui, { wrapper: AllTheProviders, ...options });
}

export * from "@testing-library/react";
export * from "@testing-library/user-event";
export { render };
