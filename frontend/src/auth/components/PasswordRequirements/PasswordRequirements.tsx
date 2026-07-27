import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const uniqueId = "b2f7c9d1-3e4a-4b6c-8d0e-1f2a3b4c5d6e";

export const DATA_TEST_ID = {
  CONTAINER: `password-requirements-${uniqueId}`,
};

export const isStrongPassword = (value: string) =>
  /.{8,}/.test(value) && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[!-/:-@[-`{-~]/.test(value);

export function PasswordRequirements({ password }: { password: string }) {
  const { t } = useTranslation();

  const rules = [
    { met: /.{8,}/.test(password), label: t("auth.passwordRules.length") },
    { met: /[a-z]/.test(password), label: t("auth.passwordRules.lowercase") },
    { met: /[A-Z]/.test(password), label: t("auth.passwordRules.uppercase") },
    { met: /\d/.test(password), label: t("auth.passwordRules.number") },
    { met: /[!-/:-@[-`{-~]/.test(password), label: t("auth.passwordRules.special") },
  ];

  return (
    <ul className="grid gap-1 text-sm" data-testid={DATA_TEST_ID.CONTAINER}>
      {rules.map((rule) => (
        <li key={rule.label} className={cn(rule.met ? "text-green-3" : "text-destructive")}>
          * {rule.label}
        </li>
      ))}
    </ul>
  );
}
