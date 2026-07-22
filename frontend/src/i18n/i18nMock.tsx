/**
 * Test-only i18n mock. Rather than initializing a real i18next instance
 * (async, slower, and requires provider wiring in every test), this mocks
 * react-i18next so useTranslation()/Trans render the REAL en-GB strings
 * synchronously. Using real copy (not placeholder mock keys) means tests
 * assert against what users actually see, while a missing key throws
 * immediately instead of silently rendering the raw dot-path key.
 *
 * Imported once from src/test/setup.ts via vi.mock, so every test gets this
 * automatically — no per-test wiring needed.
 */
import type { ReactNode } from "react";
import { Locale } from "@/i18n/constants";
import enGb from "@/i18n/locales/en-GB/translation.json";

function getByDotPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function interpolate(template: string, options?: Record<string, unknown>): string {
  if (!options) return template;
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (match, token: string) => {
    const value = options[token];
    return value === undefined ? match : String(value);
  });
}

export function stableT(key: string, options?: Record<string, unknown> & { returnObjects?: boolean }): unknown {
  const value = getByDotPath(enGb, key);
  if (value === undefined) {
    throw new Error(`Translation key not found: "${key}"`);
  }
  if (options?.returnObjects) return value;
  if (typeof value !== "string") {
    throw new Error(`Translation key "${key}" does not resolve to a string (use { returnObjects: true }).`);
  }
  return interpolate(value, options);
}

/** Parses `<0>text</0>`-style markers and substitutes the matching element from `components`. */
function renderTransChildren(template: string, components: ReactNode[] = []): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /<(\d+)>(.*?)<\/\1>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(template)) !== null) {
    if (match.index > lastIndex) parts.push(template.slice(lastIndex, match.index));
    const index = Number(match[1]);
    parts.push(components[index] ?? match[2]);
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < template.length) parts.push(template.slice(lastIndex));
  return parts;
}

export function MockTrans({
  i18nKey,
  values,
  components,
}: {
  i18nKey: string;
  values?: Record<string, unknown>;
  components?: ReactNode[];
}) {
  const template = stableT(i18nKey, values);
  if (typeof template !== "string") {
    throw new Error(`Trans i18nKey "${i18nKey}" does not resolve to a string.`);
  }
  return <>{renderTransChildren(template, components)}</>;
}

export const mockI18nInstance = {
  language: Locale.EN_GB,
  changeLanguage: () => Promise.resolve(),
  on: () => {},
  off: () => {},
};

export function useTranslationMock() {
  return { t: stableT, i18n: mockI18nInstance };
}
