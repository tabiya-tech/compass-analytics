import { setupWorker } from "msw/browser";

import {
  institutionDetailHandler,
  institutionsHandler,
  jobseekerDetailHandler,
  jobseekersHandler,
  meHandler,
  overviewMetricsHandler,
} from "./handlers";

// Mocks only what the backend can't serve locally yet — overview metrics, the institutions
// endpoints, and the jobseeker roster/profile (the backend route exists but reads from a Compass
// deployment that isn't wired up in local dev).
// Everything else — /api/me, /api/reach, and /api/modules/* — goes through the Vite proxy to the
// real backend on localhost:8080, so dev still exercises real auth and real permissions.
export const worker = setupWorker(
  overviewMetricsHandler,
  institutionsHandler,
  institutionDetailHandler,
  jobseekersHandler,
  jobseekerDetailHandler,
  meHandler
);
