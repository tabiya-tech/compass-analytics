import type { CSSProperties } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Toaster as Sonner, type ToasterProps } from "sonner";

type Status = "success" | "info" | "warning" | "error";

function statusPalette(status: Status, color: string) {
  return {
    [`--${status}-bg`]: `color-mix(in oklab, ${color} 10%, var(--popover))`,
    [`--${status}-text`]: color,
    [`--${status}-border`]: `color-mix(in oklab, ${color} 40%, transparent)`,
  };
}

const TOASTER_STYLE = {
  fontFamily: "inherit",
  "--border-radius": "var(--radius-card)",
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
  ...statusPalette("success", "var(--success)"),
  ...statusPalette("info", "var(--info)"),
  ...statusPalette("warning", "var(--warning)"),
  ...statusPalette("error", "var(--error)"),
  "--toast-close-button-start": "auto",
  "--toast-close-button-end": "12px",
  "--toast-close-button-transform": "translateY(12px)",
} as CSSProperties;

/**
 * App-wide snackbar host, mounted once at the root. `toast.success|info|warning|error` colour schemes are derived from the app's design tokens
 */
export function Toaster(props: Readonly<ToasterProps>) {
  const { t } = useTranslation();

  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      icons={{ close: <X className="size-3.5" aria-hidden="true" /> }}
      toastOptions={{
        closeButtonAriaLabel: t("common.close"),
        classNames: { content: "pr-6" },
      }}
      style={TOASTER_STYLE}
      {...props}
    />
  );
}
