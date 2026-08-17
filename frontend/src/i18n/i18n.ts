import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { getAppName } from "@/branding/branding";
import { FALL_BACK_LOCALE, Locale, SupportedLocales } from "./constants";
import enGb from "./locales/en-GB/translation.json";

const resources = {
  [Locale.EN_GB]: { translation: enGb },
};

i18n.on("missingKey", (locales, namespace, key) => {
  console.error(`Missing translation key "${key}" in namespace "${namespace}" for locale(s): ${locales.join(", ")}`);
});

/**
 * Initializes i18next. Call once at boot, after branding config has loaded
 * (getAppName() must resolve to the real app name before this runs, since
 * it's captured as a default interpolation variable for every translation).
 *
 * i18next only auto-populates `resources` for languages imported above.
 * `supportedLngs` restricts the language detector to those languages, so an
 * unsupported browser/localStorage value falls back rather than resolving to
 * an empty resource bundle.
 */
export async function initI18n(): Promise<typeof i18n> {
  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: FALL_BACK_LOCALE,
      supportedLngs: SupportedLocales,
      interpolation: {
        escapeValue: false, // React already escapes values
        defaultVariables: { appName: getAppName() },
      },
      detection: {
        order: ["localStorage", "navigator"],
        lookupLocalStorage: "i18nextLng",
        caches: ["localStorage"],
      },
    });
  return i18n;
}

export default i18n;
