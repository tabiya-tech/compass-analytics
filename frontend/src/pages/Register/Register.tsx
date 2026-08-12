import { useState, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Mail, Lock, User, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/auth/components/AuthLayout";
import { Field } from "@/auth/components/Field";
import { SocialAuth } from "@/auth/components/SocialAuth";
import { PasswordRequirements, isStrongPassword } from "@/auth/components/PasswordRequirements";
import { routerPaths } from "@/app/routerPaths";
import { AuthApiError } from "@/auth/services/Authentication.service";
import { AuthenticationServiceFactory } from "@/auth/services/Authentication.service.factory";
import { UserService } from "@/user/User.service";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const uniqueId = "c7e9a1b3-2d4f-5a6b-7c8e-9f0a1b2c3d4e";

export const DATA_TEST_ID = {
  CONTAINER: `register-container-${uniqueId}`,
  FORM: `register-form-${uniqueId}`,
  SUBMIT_BUTTON: `register-submit-button-${uniqueId}`,
  FORM_ERROR: `register-form-error-${uniqueId}`,
  LOGIN_LINK: `register-login-link-${uniqueId}`,
};

export function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const authService = AuthenticationServiceFactory.getCurrentAuthenticationService();

  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const emailValid = isValidEmail(email);
  const passwordValid = isStrongPassword(password);
  const passwordsMatch = password === confirmPassword;

  const emailError = email.length > 0 && !emailValid ? t("auth.validation.emailInvalid") : undefined;
  const confirmError =
    confirmPassword.length > 0 && !passwordsMatch ? t("auth.validation.passwordsMismatch") : undefined;

  const isFormValid =
    fullName.trim().length > 0 &&
    organization.trim().length > 0 &&
    emailValid &&
    passwordValid &&
    confirmPassword.length > 0 &&
    passwordsMatch;

  const handleSubmit = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (!isFormValid) return;

    setFormError(null);
    setSubmitting(true);
    try {
      const credential = await authService.register({ fullName, organization, email, password });
      const token = await credential.user.getIdToken();
      await UserService.getInstance().register(token);
      navigate(routerPaths.ROOT);
    } catch (error) {
      if (error instanceof AuthApiError && error.code === "email_taken") {
        setFormError(t("auth.errors.emailTaken"));
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
      const credential = await authService.loginWithGoogle();
      const token = await credential.user.getIdToken();
      await UserService.getInstance().register(token);
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
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{t("auth.register.title")}</h2>
          <p className="text-muted-foreground">{t("auth.register.subtitle")}</p>
        </header>

        <form className="grid gap-4" onSubmit={handleSubmit} noValidate data-testid={DATA_TEST_ID.FORM}>
          {formError && (
            <p role="alert" data-testid={DATA_TEST_ID.FORM_ERROR} className="text-sm text-destructive">
              {formError}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="register-full-name"
              autoComplete="name"
              label={t("auth.fields.fullName.label")}
              placeholder={t("auth.fields.fullName.placeholder")}
              icon={<User />}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <Field
              id="register-organization"
              autoComplete="organization"
              label={t("auth.fields.organization.label")}
              placeholder={t("auth.fields.organization.placeholder")}
              icon={<Building2 />}
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
            />
          </div>

          <Field
            id="register-email"
            type="email"
            autoComplete="email"
            label={t("auth.fields.email.label")}
            placeholder={t("auth.fields.email.placeholder")}
            icon={<Mail />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
          />

          <div className="grid gap-2">
            <Field
              id="register-password"
              type="password"
              autoComplete="new-password"
              label={t("auth.fields.newPassword.label")}
              placeholder={t("auth.fields.newPassword.placeholder")}
              icon={<Lock />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {password.length > 0 && !passwordValid && <PasswordRequirements password={password} />}
          </div>

          <Field
            id="register-confirm-password"
            type="password"
            autoComplete="new-password"
            label={t("auth.fields.confirmPassword.label")}
            placeholder={t("auth.fields.confirmPassword.placeholder")}
            icon={<Lock />}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={confirmError}
          />

          <Button
            type="submit"
            variant="brand"
            disabled={submitting || !isFormValid}
            data-testid={DATA_TEST_ID.SUBMIT_BUTTON}
            className="h-12 cursor-pointer rounded-pill text-base font-semibold hover:brightness-90 focus-visible:ring-2 focus-visible:ring-tabiya-blue/20"
          >
            {t("auth.register.submit")}
            <ArrowRight />
          </Button>
        </form>

        <SocialAuth onGoogle={handleGoogle} disabled={submitting} />

        <p className="text-center text-sm text-muted-foreground">
          {t("auth.register.footerPrompt")}{" "}
          <Link
            to={routerPaths.LOGIN}
            data-testid={DATA_TEST_ID.LOGIN_LINK}
            className="font-semibold text-green-3 hover:underline"
          >
            {t("auth.register.footerAction")}
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
