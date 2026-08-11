import { http, HttpResponse, type HttpHandler } from "msw";
import type { BrandingConfig } from "@/branding/brandingConfig";
import { buildOverviewMetrics, parseOverviewMetricsQuery } from "@/mocks/overview-metrics";
import { OVERVIEW_API_BASE } from "@/pages/Overview/services/OverviewMetrics.service";

/** Mirrors public/branding.json — kept as a plain object since Vite disallows importing public/ as a JS module. */
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

/** Exported individually so the browser dev worker can include only this one. */
export const brandingHandler = http.get("/branding.json", () => HttpResponse.json(defaultBranding));

/** Stands in for the not-yet-built metrics endpoint — exported individually so the browser dev worker can include it too. */
export const overviewMetricsHandler = http.get(`${OVERVIEW_API_BASE}/metrics`, ({ request }) => {
  const query = new URL(request.url).searchParams;
  return HttpResponse.json(buildOverviewMetrics(parseOverviewMetricsQuery(query)));
});

/** Full handler list for tests and Storybook, so components render with realistic data without the backend running. */
export const handlers: HttpHandler[] = [brandingHandler, overviewMetricsHandler];
