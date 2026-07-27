import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { getAppName, getLogoInverseUrl } from "@/branding/brandingConfig";

const uniqueId = "2dce0a1d-275e-4a46-952a-d9193ddd1c15";

export const DATA_TEST_ID = {
  CONTAINER: `auth-layout-container-${uniqueId}`,
  BRAND_PANEL: `auth-layout-brand-panel-${uniqueId}`,
  FORM_PANEL: `auth-layout-form-panel-${uniqueId}`,
};

export interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: Readonly<AuthLayoutProps>) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row" data-testid={DATA_TEST_ID.CONTAINER}>
      <section
        data-testid={DATA_TEST_ID.BRAND_PANEL}
        className="relative flex flex-col overflow-hidden bg-tabiya-blue px-6 py-10 text-white sm:px-10 sm:py-12 lg:w-1/2 lg:px-14 lg:py-16"
      >
        <img src={getLogoInverseUrl()} alt={getAppName()} className="relative z-10 mx-auto h-7 w-auto sm:h-8 lg:mx-0" />

        <div className="relative z-10 mt-10 max-w-xl lg:mt-auto">
          <p className="font-mono text-xs text-tabiya-green uppercase">{t("auth.brand.eyebrow")}</p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            {t("auth.brand.headline")}
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/70 sm:text-lg">{t("auth.brand.subcopy")}</p>
        </div>

        <p className="relative z-10 mt-8 text-sm text-white/50 lg:mt-auto lg:pt-14">{t("auth.brand.footer")}</p>

        <img
          src="/brand-graphic.svg"
          alt="brand graphic"
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 top-10 w-[280px] opacity-50 sm:w-[400px] lg:w-[460px]"
        />
      </section>

      <section
        data-testid={DATA_TEST_ID.FORM_PANEL}
        className="flex flex-1 items-center justify-center bg-tabiya-grey px-6 py-12 sm:px-10 lg:w-1/2 lg:py-16 lg:px-20"
      >
        <div className="w-full max-w-md">{children}</div>
      </section>
    </div>
  );
}
