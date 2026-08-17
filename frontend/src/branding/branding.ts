/**
 * Branding config, read from build-time VITE_* env vars baked into the bundle
 * at deploy time. All getters are synchronous — no fetch, no async boot step.
 *
 * Defaults match the Tabiya design tokens so a local dev build with no .env.local
 * renders correctly out of the box.
 */

const DEFAULTS = {
  appName: "Compass Analytics",
  browserTabTitle: "Compass Analytics",
  logo: "/logos/tabiya-logo-color.svg",
  logoInverse: "/logos/tabiya-logo-white.svg",
  favicon: "/logos/tabiya-logo-color.svg",
} as const;

export function getAppName(): string {
  return import.meta.env.VITE_APP_NAME || DEFAULTS.appName;
}

export function getBrowserTabTitle(): string {
  return import.meta.env.VITE_BROWSER_TAB_TITLE || DEFAULTS.browserTabTitle;
}

export function getMetaDescription(): string | undefined {
  return import.meta.env.VITE_META_DESCRIPTION || undefined;
}

export function getLogoUrl(): string {
  return import.meta.env.VITE_LOGO_URL || DEFAULTS.logo;
}

export function getLogoInverseUrl(): string {
  return import.meta.env.VITE_LOGO_INVERSE_URL || DEFAULTS.logoInverse;
}

export function getFaviconUrl(): string {
  return import.meta.env.VITE_FAVICON_URL || DEFAULTS.favicon;
}

/** Returns a map of CSS custom property name → value for all set theme tokens. */
export function getThemeCssVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  const mapping: Record<string, string> = {
    VITE_THEME_TABIYA_BLUE: "--tabiya-blue",
    VITE_THEME_TABIYA_GREEN: "--tabiya-green",
    VITE_THEME_LIGHT_GREEN: "--light-green",
    VITE_THEME_TABIYA_GREY: "--tabiya-grey",
    VITE_THEME_GREEN_2: "--green-2",
    VITE_THEME_GREEN_3: "--green-3",
    VITE_THEME_GREY_TEXT: "--grey-text",
    VITE_THEME_FONT_PRIMARY: "--font-primary",
    VITE_THEME_FONT_MONO: "--font-mono",
  };
  for (const [envKey, cssVar] of Object.entries(mapping)) {
    const value = import.meta.env[envKey];
    if (value) vars[cssVar] = value;
  }
  return vars;
}

/** Applies branding to the document synchronously. Call once before rendering. */
export function applyBranding(): void {
  document.title = getBrowserTabTitle();

  const description = getMetaDescription();
  if (description) {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;
  }

  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = getFaviconUrl();

  const theme = getThemeCssVars();
  for (const [cssVar, value] of Object.entries(theme)) {
    document.documentElement.style.setProperty(cssVar, value);
  }
}
