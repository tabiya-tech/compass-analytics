import { setupWorker } from "msw/browser";
import { institutionDetailHandler, institutionsHandler, overviewMetricsHandler } from "./handlers";

// Mocks only what the backend can't serve yet — overview metrics and the institutions endpoints.
// Everything else goes through the Vite proxy to the real backend on localhost:8080.
export const worker = setupWorker(overviewMetricsHandler, institutionsHandler, institutionDetailHandler);
