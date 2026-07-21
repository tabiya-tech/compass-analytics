import {
  getBrowserTabTitle,
  getFaviconUrl,
  getMetaDescription,
  getThemeTokens,
  loadBrandingConfig,
} from "./brandingConfig";

function setCssVar(name: string, value: string | undefined) {
  if (!value) return;
  document.documentElement.style.setProperty(name, value);
}

function upsertLinkHref(rel: string, href: string) {
  let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
}

function upsertMetaDescription(content: string | undefined) {
  if (!content) return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "description";
    document.head.appendChild(meta);
  }
  meta.content = content;
}

/**
 * Loads /branding.json and applies it to the document: CSS custom properties
 * on :root (colors + fonts, overriding the defaults in src/index.css), the
 * page title, meta description, and favicon. Call once at boot, before the
 * app renders, so there's no flash of unbranded content.
 */
export async function applyBranding(): Promise<void> {
  await loadBrandingConfig();

  const theme = getThemeTokens();
  Object.entries(theme).forEach(([key, value]) => setCssVar(`--${key}`, value));

  document.title = getBrowserTabTitle();
  upsertMetaDescription(getMetaDescription());
  upsertLinkHref("icon", getFaviconUrl());
}
