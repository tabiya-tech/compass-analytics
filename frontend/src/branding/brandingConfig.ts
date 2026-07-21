/**
 * Branding/customization config, loaded once at boot from /branding.json.
 *
 * This is the equivalent of compass's config/default.json + envService.ts,
 * adapted for a frontend-only repo with no backend/iac yet: instead of
 * baking config into a build artifact per deployment, we fetch a static
 * JSON file at runtime so it can be swapped per deployment target without
 * a rebuild. Missing or malformed fields fall back to defaults silently,
 * matching compass's "never break rendering over a config typo" philosophy.
 */

export interface BrandingTheme {
  "tabiya-blue"?: string;
  "tabiya-green"?: string;
  "light-green"?: string;
  "tabiya-grey"?: string;
  "green-2"?: string;
  "green-3"?: string;
  "grey-text"?: string;
  "font-primary"?: string;
  "font-mono"?: string;
}

export interface BrandingAssets {
  logo?: string;
  logoInverse?: string;
  favicon?: string;
}

export interface BrandingConfig {
  appName?: string;
  browserTabTitle?: string;
  metaDescription?: string;
  assets?: BrandingAssets;
  theme?: BrandingTheme;
}

const DEFAULTS = {
  appName: "Compass Analytics",
  browserTabTitle: "Compass Analytics",
  logo: "/logos/tabiya-logo-color.svg",
  logoInverse: "/logos/tabiya-logo-white.svg",
  favicon: "/logos/tabiya-logo-color.svg",
} as const;

let config: BrandingConfig = {};

/** Fetches and caches /branding.json. Call once at app boot, before rendering. */
export async function loadBrandingConfig(): Promise<BrandingConfig> {
  try {
    const response = await fetch("/branding.json");
    if (!response.ok) throw new Error(`branding.json responded with ${response.status}`);
    config = (await response.json()) as BrandingConfig;
  } catch (error) {
    console.warn("Could not load /branding.json, falling back to defaults.", error);
    config = {};
  }
  return config;
}

export function getAppName(): string {
  return config.appName || DEFAULTS.appName;
}

export function getBrowserTabTitle(): string {
  return config.browserTabTitle || DEFAULTS.browserTabTitle;
}

export function getMetaDescription(): string | undefined {
  return config.metaDescription;
}

export function getLogoUrl(): string {
  return config.assets?.logo || DEFAULTS.logo;
}

export function getLogoInverseUrl(): string {
  return config.assets?.logoInverse || DEFAULTS.logoInverse;
}

export function getFaviconUrl(): string {
  return config.assets?.favicon || DEFAULTS.favicon;
}

export function getThemeTokens(): BrandingTheme {
  return config.theme || {};
}
