import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import "./index.css";
import App from "./App.tsx";
import { applyBranding } from "./branding/applyBranding";
import { initI18n } from "./i18n/i18n";
import { initSentry } from "./sentry/sentryInit";
import { ErrorFallback } from "./sentry/ErrorFallback";

// Sentry init happens first, before anything else, so errors during the
// earliest boot steps below are still captured.
initSentry();

async function enableMocking() {
  if (!import.meta.env.DEV) return;
  const { worker } = await import("./mocks/browser");
  return worker.start({ onUnhandledRequest: "bypass" });
}

async function boot() {
  await enableMocking();
  // Branding must resolve before i18n init, since i18n captures the app name
  // as a default interpolation variable available to every translation.
  await applyBranding();
  await initI18n();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
        <App />
      </Sentry.ErrorBoundary>
    </StrictMode>
  );
}

boot();
