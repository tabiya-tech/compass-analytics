import { http, HttpResponse, type HttpHandler } from "msw";
import type { BrandingConfig } from "@/branding/brandingConfig";
import { buildOverviewMetrics, parseOverviewMetricsQuery } from "@/mocks/overview-metrics";
import { OVERVIEW_API_BASE } from "@/pages/Overview/services/OverviewMetrics.service";
import type { InstitutionSortKey, SortDirection } from "@/institutions/institutions.types";
import { findInstitutionDetail, queryInstitutions } from "@/mocks/data/institutions";

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

/** Applies the query server-side, the way the real endpoint will: search, filter, sort, paginate. */
export const institutionsHandler = http.get("/api/institutions", ({ request }) => {
  const params = new URL(request.url).searchParams;
  return HttpResponse.json(
    queryInstitutions({
      search: params.get("search") ?? undefined,
      regions: params.getAll("region"),
      sort: {
        by: (params.get("sort_by") as InstitutionSortKey | null) ?? "registered_users",
        direction: (params.get("sort_dir") as SortDirection | null) ?? "desc",
      },
      page: Number(params.get("page") ?? 1),
      page_size: Number(params.get("page_size") ?? 30),
    })
  );
});

/** The drill-down behind a table row. */
export const institutionDetailHandler = http.get("/api/institutions/:institutionId", ({ params }) => {
  const detail = findInstitutionDetail(String(params.institutionId));
  return detail ? HttpResponse.json(detail) : new HttpResponse(null, { status: 404 });
});

/** Stands in for the not-yet-built metrics endpoint — exported individually so the browser dev worker can include it too. */
export const overviewMetricsHandler = http.get(`${OVERVIEW_API_BASE}/metrics`, ({ request }) => {
  const query = new URL(request.url).searchParams;
  return HttpResponse.json(buildOverviewMetrics(parseOverviewMetricsQuery(query)));
});

/** Full handler list for tests and Storybook, so components render with realistic data without the backend running. */
export const handlers: HttpHandler[] = [
  brandingHandler,
  overviewMetricsHandler,
  institutionsHandler,
  institutionDetailHandler,
];
