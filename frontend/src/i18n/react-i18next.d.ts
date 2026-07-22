import type { TFunction } from "i18next";
import type { i18n as I18nInstance } from "i18next";
import defaultLanguage from "./locales/en-GB/translation.json";

type DotKeys<T> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown> ? `${K}` | `${K}.${DotKeys<T[K]>}` : `${K}`;
}[keyof T & string];

export type TranslationKey = DotKeys<typeof defaultLanguage>;

declare module "react-i18next" {
  export function useTranslation(): {
    t: (key: TranslationKey, options?: Record<string, unknown>) => string;
    i18n: I18nInstance;
  };
}

// Re-exported so consumers can annotate a `t` param without importing i18next directly.
export type TypedTFunction = TFunction & {
  (key: TranslationKey, options?: Record<string, unknown>): string;
};
