import { useEffect } from "react";
import type { Preview } from "@storybook/react-vite";
import { initialize, mswLoader } from "msw-storybook-addon";
import { I18nextProvider } from "react-i18next";
import { HashRouter } from "react-router-dom";
import "../src/index.css";
import { handlers } from "../src/mocks/handlers";
import { initI18n } from "../src/i18n/i18n";
import { Locale, LocalesLabels, SupportedLocales } from "../src/i18n/constants";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthContext";
import { Toaster } from "../src/components/ui/sonner";

initialize({ onUnhandledRequest: "bypass" });

const localeOptions = SupportedLocales.map((locale) => ({ value: locale, title: LocalesLabels[locale] }));

const STUB_USER = { uid: "storybook-user", email: "storybook@example.com" } as AuthContextValue["user"];

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
    // Branding is now synchronous (VITE_* vars baked at build time) — no loader needed.
    async () => ({ i18n: await initI18n() }),
  ],
  decorators: [
    (Story, context) => {
      const i18n = context.loaded.i18n;
      useEffect(() => {
        void i18n.changeLanguage(context.globals.locale);
      }, [i18n, context.globals.locale]);

      const authValue: AuthContextValue = {
        user: context.globals.loggedIn ? STUB_USER : null,
        loading: false,
        getIdToken: async () => "storybook-stub-token",
      };

      return (
        <AuthContext.Provider value={authValue}>
          <HashRouter>
            <I18nextProvider i18n={i18n}>
              <Story />
              <Toaster />
            </I18nextProvider>
          </HashRouter>
        </AuthContext.Provider>
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
    loggedIn: {
      name: "Logged in",
      description: "Simulate an authenticated user",
      toolbar: {
        icon: "user",
        items: [
          { value: true, title: "Signed in" },
          { value: false, title: "Signed out" },
        ],
        defaultValue: true,
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
