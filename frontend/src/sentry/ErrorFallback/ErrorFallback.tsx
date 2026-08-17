import { useTranslation } from "react-i18next";
import { getLogoUrl } from "@/branding/branding";
import { Button } from "@/components/ui/button";

export function ErrorFallback() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <img src={getLogoUrl()} alt="" className="h-8 w-auto" />
      <div className="flex flex-col gap-2">
        <h1 style={{ fontSize: "var(--text-h3)" }} className="font-semibold text-foreground">
          {t("error.errorPage.title")}
        </h1>
        <p style={{ fontSize: "var(--text-body)" }} className="max-w-md text-muted-foreground">
          {t("error.errorPage.defaultMessage")}
        </p>
      </div>
      <Button onClick={() => window.location.reload()}>{t("error.errorPage.reload")}</Button>
    </div>
  );
}
