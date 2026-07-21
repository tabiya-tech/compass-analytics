import type { HttpHandler } from "msw";

/**
 * Shared MSW request handlers, consumed by both the browser worker
 * (src/mocks/browser.ts, for `yarn dev`) and Storybook
 * (.storybook/preview.tsx), so app and stories mock the same API.
 */
export const handlers: HttpHandler[] = [];
