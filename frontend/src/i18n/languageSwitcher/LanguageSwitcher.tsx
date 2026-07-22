import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocalesLabels, SupportedLocales, type Locale } from "@/i18n/constants";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const handleChange = (locale: string) => {
    void i18n.changeLanguage(locale);
  };

  return (
    <Select value={i18n.language} onValueChange={handleChange}>
      <SelectTrigger
        aria-label={t("i18n.languageSwitcher.label")}
        size="sm"
        className="w-full border-sidebar-border bg-transparent text-sidebar-foreground"
      >
        <Globe className="size-4" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SupportedLocales.map((locale: Locale) => (
          <SelectItem key={locale} value={locale}>
            {LocalesLabels[locale]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
