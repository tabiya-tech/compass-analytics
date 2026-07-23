import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import { HashRouter } from "react-router-dom";

// Wraps components under test in app-wide providers
export const AllTheProviders = ({ children }: { children: ReactNode }) => {
  return <HashRouter>{children}</HashRouter>;
};

function render(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return rtlRender(ui, { wrapper: AllTheProviders, ...options });
}

export * from "@testing-library/react";
export * from "@testing-library/user-event";
export { render };
