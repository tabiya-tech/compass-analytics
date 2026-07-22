import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "@/mocks/server";
import { MockTrans, mockI18nInstance, useTranslationMock } from "@/i18n/i18nMock";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real en-GB strings, rendered synchronously, throwing on missing keys —
// see src/i18n/i18nMock.tsx for the rationale.
vi.mock("react-i18next", () => ({
  useTranslation: useTranslationMock,
  Trans: MockTrans,
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/i18n/i18n", () => ({
  default: mockI18nInstance,
  initI18n: () => Promise.resolve(mockI18nInstance),
}));

// jsdom doesn't implement matchMedia; shadcn's use-mobile hook needs it.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
