import { http, HttpResponse, type HttpHandler } from "msw";
import type { BrandingConfig } from "@/branding/brandingConfig";
import type { ReachResponse } from "@/analytics/analytics.types";
import type { MeResponse } from "@/user/user.types";

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

const stubReach: ReachResponse = {
  summary: {
    total_users: 12_450,
    active_users_30d: 3_210,
    total_logins: 48_900,
    avg_logins_per_user: 3.93,
    avg_session_minutes: 22,
  },
  series: [
    { label: "Jan", cumulative: 8_000, added: 900, new_users: 900, returning: 7_100, logins: 6_200 },
    { label: "Feb", cumulative: 9_200, added: 1_200, new_users: 1_200, returning: 8_000, logins: 7_100 },
    { label: "Mar", cumulative: 10_400, added: 1_100, new_users: 1_100, returning: 9_300, logins: 8_400 },
    { label: "Apr", cumulative: 11_100, added: 700, new_users: 700, returning: 10_400, logins: 9_100 },
    { label: "May", cumulative: 11_800, added: 700, new_users: 700, returning: 11_100, logins: 9_800 },
    { label: "Jun", cumulative: 12_450, added: 650, new_users: 650, returning: 11_800, logins: 10_400 },
  ],
};

const stubMe: MeResponse = {
  user_id: "dev-funder",
  email: "funder@example.com",
  name: "Dev Funder",
  role: "funder",
  scope: { type: "all", institution_ids: [] },
  active_modules: ["build-your-profile", "job-readiness", "career-explorer", "jobs"],
};

/** Exported individually so the browser dev worker can include only this one. */
export const brandingHandler = http.get("/branding.json", () => HttpResponse.json(defaultBranding));

/**
 * Full handler list for tests and Storybook — includes all API stubs so
 * components render with realistic data without needing the backend running.
 */
export const handlers: HttpHandler[] = [
  brandingHandler,
  http.get("/api/me", () => HttpResponse.json(stubMe)),
  http.get("/api/reach", () => HttpResponse.json(stubReach)),
];
