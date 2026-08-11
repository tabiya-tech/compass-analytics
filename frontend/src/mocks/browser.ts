import { setupWorker } from "msw/browser";
import { brandingHandler, overviewMetricsHandler } from "./handlers";

// Branding and overview metrics are mocked here too, since neither is served by the real backend yet.
// Everything else goes through the Vite proxy to the backend running on localhost:8080.
export const worker = setupWorker(brandingHandler, overviewMetricsHandler);
