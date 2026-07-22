export const Locale = {
  EN_GB: "en-GB",
} as const;

export type Locale = (typeof Locale)[keyof typeof Locale];

/** The locale used when detection fails or resolves to something unsupported. */
export const FALL_BACK_LOCALE: Locale = Locale.EN_GB;

export const SupportedLocales: Locale[] = [Locale.EN_GB];

/** Native-language display names, shown in the language switcher. */
export const LocalesLabels: Record<Locale, string> = {
  [Locale.EN_GB]: "English (UK)",
};
