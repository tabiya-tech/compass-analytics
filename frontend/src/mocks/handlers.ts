import { http, HttpResponse, type HttpHandler } from "msw";
import type { BrandingConfig } from "@/branding/brandingConfig";

/**
 * Mirrors public/branding.json. Kept as a plain object (not imported from
 * public/, which Vite disallows importing as a JS module) so jsdom — which
 * has no dev server to serve static files from — gets the same response
 * Vite/Storybook's real dev server would serve for this request.
 */
const defaultBranding: BrandingConfig = {
  appName: "Compass Analytics",
  browserTabTitle: "Compass Analytics",
  metaDescription:
    "Central analytics dashboard for Tabiya's products, giving reach, engagement, and outcome data to implementers and funders.",
  assets: {
    logo: "/logos/tabiya-logo-color.svg",
    logoInverse: "/logos/tabiya-logo-white.svg",
    favicon: "/logos/tabiya-logo-color.svg",
  },
  theme: {
    "tabiya-blue": "#002147",
    "tabiya-green": "#00ff91",
    "light-green": "#e4f8e2",
    "tabiya-grey": "#f8f5f0",
    "green-2": "#26b87d",
    "green-3": "#247066",
    "grey-text": "#757575",
    "font-primary": "'DM Sans', system-ui, -apple-system, sans-serif",
    "font-mono": "'DM Mono', 'SF Mono', ui-monospace, monospace",
  },
};

/**
 * Shared MSW request handlers, consumed by both the browser worker
 * (src/mocks/browser.ts, for `yarn dev`) and Storybook
 * (.storybook/preview.tsx), so app and stories mock the same API.
 */
export const handlers: HttpHandler[] = [http.get("/branding.json", () => HttpResponse.json(defaultBranding))];
