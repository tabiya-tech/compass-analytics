import * as Sentry from "@sentry/react";

/**
 * Sentry config, read from build-time Vite env vars (baked in per build/deployment,
 * unlike branding/i18n which are fetched/loaded at runtime).
 *
 * VITE_SENTRY_ENABLED must be the literal string "true" to enable — any other
 * value (including unset) leaves Sentry off, so an unconfigured/local build
 * never accidentally reports errors.
 */
function isSentryEnabled(): boolean {
  return import.meta.env.VITE_SENTRY_ENABLED === "true";
}

/**
 * Initializes Sentry error tracking. Call once at boot, before the app
 * renders, so errors during the earliest render are still captured.
 * No-ops (with a console notice) if disabled or misconfigured.
 */
export function initSentry(): void {
  if (!isSentryEnabled()) {
    console.info("Sentry is not enabled (VITE_SENTRY_ENABLED is not set to true).");
    return;
  }

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.warn("Sentry is enabled but VITE_SENTRY_DSN is not set; skipping Sentry initialization.");
    return;
  }

  const tracesSampleRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "1.0");

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_TARGET_ENVIRONMENT_NAME ?? import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration(), Sentry.captureConsoleIntegration({ levels: ["error"] })],
    tracesSampleRate,
  });
}
