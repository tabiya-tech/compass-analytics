import { useTranslation } from "react-i18next";
import { getLogoUrl } from "@/branding/brandingConfig";
import { Button } from "@/components/ui/button";
import { AuthenticationServiceFactory } from "@/auth/services/Authentication.service.factory";

const uniqueId = "c4a7b2e1-9f3d-4a6c-8e5b-1d0f2a3b4c5d";

export const DATA_TEST_ID = {
  root: `access-error-page-${uniqueId}`,
  message: `access-error-page-message-${uniqueId}`,
};

type AccessErrorPageVariant = "error" | "unprovisioned";

interface AccessErrorPageProps {
  variant: AccessErrorPageVariant;
}

export function AccessErrorPage({ variant }: Readonly<AccessErrorPageProps>) {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      data-testid={DATA_TEST_ID.root}
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center"
    >
      <img src={getLogoUrl()} alt="" className="h-8 w-auto" />
      <div className="flex flex-col gap-2">
        <p
          data-testid={DATA_TEST_ID.message}
          style={{ fontSize: "var(--text-body)" }}
          className="max-w-md text-muted-foreground"
        >
          {t(variant === "error" ? "access.error" : "access.unprovisioned")}
        </p>
      </div>
      <div className="flex gap-3">
        {variant === "error" && <Button onClick={() => window.location.reload()}>{t("common.retry")}</Button>}
        <Button
          variant="outline"
          onClick={() => AuthenticationServiceFactory.getCurrentAuthenticationService().logout()}
        >
          {t("auth.signOut")}
        </Button>
      </div>
    </div>
  );
}
