import { setupWorker } from "msw/browser";

import {
  careerExplorerHandler,
  institutionDetailHandler,
  institutionsHandler,
  jobseekerDetailHandler,
  jobseekersHandler,
  meHandler,
  moduleMetricsHandler,
  overviewMetricsHandler,
} from "./handlers";

// Mocks only what the backend can't serve locally yet — overview metrics, the institutions
// endpoints, the jobseeker roster/profile, and Career Explorer (the backend routes exist but read
// from a Compass deployment that isn't wired up in local dev; Compass has no
// /analytics/modules/career-explorer upstream yet, so the real call would only ever degrade).
// Everything else — /api/me and the grants behind it included — goes through the Vite proxy to the
// real backend on localhost:8080, so dev still exercises real auth and real permissions.
export const worker = setupWorker(
  overviewMetricsHandler,
  institutionsHandler,
  institutionDetailHandler,
  jobseekersHandler,
  jobseekerDetailHandler,
  moduleMetricsHandler,
  careerExplorerHandler,
  meHandler
);
