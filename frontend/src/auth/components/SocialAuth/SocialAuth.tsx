import { useTranslation } from "react-i18next";
import { FcGoogle } from "react-icons/fc";
import { Button } from "@/components/ui/button";

const uniqueId = "a1c4e6f8-0b2d-4e6a-9c8b-3f5d7a9b1c2e";

export const DATA_TEST_ID = {
  DIVIDER: `auth-social-divider-${uniqueId}`,
  GOOGLE_BUTTON: `auth-social-google-button-${uniqueId}`,
};

export interface SocialAuthProps {
  onGoogle: () => void;
  disabled?: boolean;
}

export function SocialAuth({ onGoogle, disabled }: SocialAuthProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-4" data-testid={DATA_TEST_ID.DIVIDER}>
        <span className="h-px flex-1 bg-border" />
        <span className="font-mono text-xs tracking-[2px] text-muted-foreground">{t("auth.social.divider")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onGoogle}
        disabled={disabled}
        data-testid={DATA_TEST_ID.GOOGLE_BUTTON}
        className="h-12 rounded-pill border-border bg-card text-base font-medium hover:bg-black/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-tabiya-green/15 cursor-pointer"
      >
        <FcGoogle className="size-5" />
        {t("auth.social.google")}
      </Button>
    </div>
  );
}
