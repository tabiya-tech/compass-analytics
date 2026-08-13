import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "@/mocks/server";
import { MockTrans, mockI18nInstance, useTranslationMock } from "@/i18n/i18nMock";

// Mock Firebase Auth so tests never hit the real Firebase SDK or network.
// AuthContext and AuthenticationService are both covered by unit tests that
// mock firebase/auth directly; this global ensures any component that renders
// under AuthProvider gets a signed-in stub user without needing Firebase config.
vi.mock("firebase/auth", () => {
  const mockUser = { uid: "test-uid", email: "test@example.com", getIdToken: async () => "test-id-token" };
  class MockGoogleAuthProvider {}
  return {
    getAuth: vi.fn(() => ({})),
    onAuthStateChanged: vi.fn((_auth: unknown, callback: (user: unknown) => void) => {
      callback(mockUser);
      return () => {};
    }),
    signInWithEmailAndPassword: vi.fn(async () => ({ user: mockUser })),
    createUserWithEmailAndPassword: vi.fn(async () => ({ user: mockUser })),
    signInWithPopup: vi.fn(async () => ({ user: mockUser })),
    GoogleAuthProvider: MockGoogleAuthProvider,
    signOut: vi.fn(async () => {}),
  };
});

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => [{}]),
}));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real en-GB strings, rendered synchronously, throwing on missing keys —
// see src/i18n/i18nMock.tsx for the rationale.
// vi.mock factories are hoisted above imports; use vi.importActual to avoid
// the "cannot access before initialization" error when referencing imported vars.
vi.mock("react-i18next", async () => {
  const {
    useTranslationMock: t,
    MockTrans: Trans,
    mockI18nInstance: i18n,
  } = await vi.importActual<typeof import("@/i18n/i18nMock")>("@/i18n/i18nMock");
  return {
    useTranslation: t,
    Trans,
    initReactI18next: { type: "3rdParty", init: () => {} },
    _i18n: i18n,
  };
});
vi.mock("@/i18n/i18n", async () => {
  const { mockI18nInstance: i18n } = await vi.importActual<typeof import("@/i18n/i18nMock")>("@/i18n/i18nMock");
  return {
    default: i18n,
    initI18n: () => Promise.resolve(i18n),
  };
});

// jsdom has no ResizeObserver, so a measuring chart sees width 0 and draws
// nothing. Report a fixed box; Storybook's browser tests use the real thing.
export const TEST_CONTAINER_WIDTH = 600;
export const TEST_CONTAINER_HEIGHT = 300;

vi.stubGlobal(
  "ResizeObserver",
  class {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      const size = { inlineSize: TEST_CONTAINER_WIDTH, blockSize: TEST_CONTAINER_HEIGHT };
      this.callback(
        [
          {
            target,
            contentRect: { width: TEST_CONTAINER_WIDTH, height: TEST_CONTAINER_HEIGHT },
            borderBoxSize: [size],
            contentBoxSize: [size],
          } as unknown as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver
      );
    }
    unobserve() {}
    disconnect() {}
  }
);

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

// Keep the named imports available for tests that import from setup.ts.
export { MockTrans, mockI18nInstance, useTranslationMock };
