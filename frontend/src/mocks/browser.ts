import { setupWorker } from "msw/browser";
import { brandingHandler } from "./handlers";

// Only mock branding in the dev browser worker — all API calls go through
// the Vite proxy to the real backend running on localhost:8080.
export const worker = setupWorker(brandingHandler);
