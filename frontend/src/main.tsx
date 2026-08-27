import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import "./index.css";
import App from "@/app";
import { applyBranding } from "./branding/branding";
import { initI18n } from "./i18n/i18n";
import { initSentry } from "./sentry/sentryInit";
import { ErrorFallback } from "./sentry/ErrorFallback";

// Sentry init happens first, before anything else, so errors during the
// earliest boot steps below are still captured.
initSentry();

async function enableMocking() {
  if (import.meta.env.VITE_MSW === "true") {
    const { worker } = await import("./mocks/browser");
    const result = await worker.start({ onUnhandledRequest: "bypass" });
    console.warn("[MSW] Mock Service Worker is active — API responses are intercepted and mocked.");
    return result;
  }

  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
  } catch (error) {
    console.warn("Could not unregister a previously cached service worker:", error);
  }
}

async function boot() {
  await enableMocking();
  // Branding is synchronous (VITE_* vars baked at build time), so it must run
  // before i18n init which captures the app name as a default interpolation variable.
  applyBranding();
  await initI18n();

  const { AuthProvider } = await import("./auth/AuthContext");

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </Sentry.ErrorBoundary>
    </StrictMode>
  );
}

boot();
