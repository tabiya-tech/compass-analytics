import { useEffect } from "react";
import type { Preview } from "@storybook/react-vite";
import { initialize, mswLoader } from "msw-storybook-addon";
import { I18nextProvider } from "react-i18next";
import { HashRouter } from "react-router-dom";
import "../src/index.css";
import { handlers } from "../src/mocks/handlers";
import { loadBrandingConfig } from "../src/branding/brandingConfig";
import { initI18n } from "../src/i18n/i18n";
import { Locale, LocalesLabels, SupportedLocales } from "../src/i18n/constants";

initialize({ onUnhandledRequest: "bypass" });

const localeOptions = SupportedLocales.map((locale) => ({ value: locale, title: LocalesLabels[locale] }));

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      // Fail the build in CI (yarn test:accessibility); stay lenient locally
      // so a11y issues surface without blocking iteration.
      test: import.meta.env.CI ? "error" : "todo",
    },

    msw: {
      handlers,
    },
  },
  loaders: [
    mswLoader,
    async () => ({ branding: await loadBrandingConfig() }),
    // Branding must load before i18n init, since i18n captures the app name
    // as a default interpolation variable — same ordering as src/main.tsx.
    async () => ({ i18n: await initI18n() }),
  ],
  decorators: [
    (Story, context) => {
      const i18n = context.loaded.i18n;
      useEffect(() => {
        void i18n.changeLanguage(context.globals.locale);
      }, [i18n, context.globals.locale]);

      return (
        <HashRouter>
          <I18nextProvider i18n={i18n}>
            <Story />
          </I18nextProvider>
        </HashRouter>
      );
    },
  ],
  globalTypes: {
    locale: {
      name: "Locale",
      description: "Internationalization locale",
      toolbar: {
        icon: "globe",
        items: localeOptions,
        defaultValue: Locale.EN_GB,
        showName: true,
      },
    },
  },
};

export default preview;
