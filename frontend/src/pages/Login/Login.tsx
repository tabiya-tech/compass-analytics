import { useState, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAppName } from "@/branding/brandingConfig";
import { AuthLayout } from "@/auth/components/AuthLayout";
import { Field } from "@/auth/components/Field";
import { SocialAuth } from "@/auth/components/SocialAuth";
import { routerPaths } from "@/app/routerPaths";
import { AuthApiError } from "@/auth/services/Authentication.service";
import { AuthenticationServiceFactory } from "@/auth/services/Authentication.service.factory";

const uniqueId = "9f2a7b3c-4d5e-6a7b-8c9d-0e1f2a3b4c5d";

export const DATA_TEST_ID = {
  CONTAINER: `login-container-${uniqueId}`,
  FORM: `login-form-${uniqueId}`,
  SUBMIT_BUTTON: `login-submit-button-${uniqueId}`,
  FORGOT_PASSWORD_LINK: `login-forgot-password-link-${uniqueId}`,
  FORM_ERROR: `login-form-error-${uniqueId}`,
  REGISTER_LINK: `login-register-link-${uniqueId}`,
};

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const authService = AuthenticationServiceFactory.getCurrentAuthenticationService();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Login doesn't validate the email format — the account already exists; we
  // only guard against submitting an empty form.
  const isFormValid = email.trim().length > 0 && password.length > 0;

  const handleSubmit = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (!isFormValid) return;

    setFormError(null);
    setSubmitting(true);
    try {
      await authService.login({ email, password });
      navigate(routerPaths.ROOT);
    } catch (error) {
      if (error instanceof AuthApiError && error.code === "invalid_credentials") {
        setFormError(t("auth.errors.invalidCredentials"));
      } else {
        setFormError(t("auth.errors.generic"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setFormError(null);
    setSubmitting(true);
    try {
      await authService.loginWithGoogle();
      navigate(routerPaths.ROOT);
    } catch {
      setFormError(t("auth.errors.generic"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="grid gap-8" data-testid={DATA_TEST_ID.CONTAINER}>
        <header className="grid gap-2">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{t("auth.login.title")}</h2>
          <p className="text-muted-foreground">{t("auth.login.subtitle")}</p>
        </header>

        <form className="grid gap-4" onSubmit={handleSubmit} noValidate data-testid={DATA_TEST_ID.FORM}>
          {formError && (
            <p role="alert" data-testid={DATA_TEST_ID.FORM_ERROR} className="text-sm text-destructive">
              {formError}
            </p>
          )}

          <Field
            id="login-email"
            type="email"
            autoComplete="email"
            label={t("auth.fields.email.label")}
            placeholder={t("auth.fields.email.placeholder")}
            icon={<Mail />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="grid gap-1.5">
            <Field
              id="login-password"
              type="password"
              autoComplete="current-password"
              label={t("auth.fields.password.label")}
              placeholder={t("auth.fields.password.placeholder")}
              icon={<Lock />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="flex justify-end">
              <a
                href="#"
                data-testid={DATA_TEST_ID.FORGOT_PASSWORD_LINK}
                className="text-sm font-medium text-green-3 hover:underline"
              >
                {t("auth.login.forgotPassword")}
              </a>
            </div>
          </div>

          <Button
            type="submit"
            variant="brand"
            disabled={submitting || !isFormValid}
            data-testid={DATA_TEST_ID.SUBMIT_BUTTON}
            className="h-12 cursor-pointer rounded-pill text-base font-semibold hover:brightness-90 focus-visible:ring-2 focus-visible:ring-tabiya-blue/20"
          >
            {t("auth.login.submit")}
            <ArrowRight />
          </Button>
        </form>

        <SocialAuth onGoogle={handleGoogle} disabled={submitting} />

        <p className="text-center text-sm text-muted-foreground">
          {t("auth.login.footerPrompt", { appName: getAppName() })}{" "}
          <Link
            to={routerPaths.REGISTER}
            data-testid={DATA_TEST_ID.REGISTER_LINK}
            className="font-semibold text-green-3 hover:underline"
          >
            {t("auth.login.footerAction")}
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
