import { setupWorker } from "msw/browser";
import { brandingHandler, institutionDetailHandler, institutionsHandler, overviewMetricsHandler } from "./handlers";

// Mocks only what the backend can't serve yet — branding, overview metrics, and the institutions endpoints.
// Everything else goes through the Vite proxy to the real backend on localhost:8080.
export const worker = setupWorker(
  brandingHandler,
  overviewMetricsHandler,
  institutionsHandler,
  institutionDetailHandler
);
