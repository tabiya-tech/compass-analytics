# Compass Analytics — AI Agent Instructions

## Project Overview

Compass Analytics is the partner-facing analytics dashboard for Tabiya Compass. It gives two kinds of users visibility
into a Compass deployment:

- **Implementers** — organizations running Compass directly with jobseekers at one institution. They see reach,
  engagement, and outcome data scoped to their own deployment.
- **Funders** — program managers overseeing a portfolio of implementing institutions within a single national
  deployment. They see an aggregated cross-institution view, plus the ability to drill into any one institution.

The dashboard covers reach/growth metrics, per-module engagement (Build Your Profile, Job Readiness, Career Explorer,
Jobs), jobseeker demographics, and — behind a "v2" flag — cost and platform-health metrics.

## Repository Structure

This is a monorepo with three top-level packages:

```
compass-analytics/
├── frontend/          # React/TypeScript SPA (the dashboard itself)
├── backend/           # FastAPI + Pydantic API
└── iac/               # Not yet implemented
```

There is no root-level orchestration tool (no Turborepo/Nx) — each subproject is a self-contained package with its
own dependency manifest and tooling (`frontend/package.json`, `backend/pyproject.toml`), wired together only by the
root [`run-before-merge.sh`](run-before-merge.sh) script.

## Tech Stack

| Layer          | Technology                                                             |
| -------------- | ----------------------------------------------------------------------|
| Frontend build | Vite, React 19, TypeScript                                             |
| Styling        | Tailwind CSS v4 + shadcn/ui (Radix primitives), Tabiya design tokens    |
| Component dev  | Storybook 10 (`@storybook/addon-vitest`, `@storybook/addon-a11y`)       |
| Testing        | Vitest (jsdom "unit" project + browser-mode "storybook" project), Testing Library, MSW |
| Linting        | oxlint                                                                  |
| Formatting     | Prettier                                                                |
| Error tracking | `@sentry/react` (frontend)                                              |
| Backend        | Python 3.11, FastAPI, Pydantic v2, Motor (async MongoDB), Poetry        |
| Backend testing| pytest (pytest-asyncio, pytest-mock, pytest-repeat), in-memory MongoDB via `pymongo_inmemory` |
| Backend linting| pylint (+ pylint-pydantic), bandit                                      |
| Infrastructure | Not yet decided                                                        |

## Design System

The UI is built on Tabiya's shared design tokens (Oxford/Tabiya Blue `#002147`, Tabiya Green `#00FF91`, DM Sans/DM
Mono), wired into Tailwind v4's `@theme inline` and mapped onto shadcn's semantic CSS variables in
[`frontend/src/index.css`](frontend/src/index.css). When adjusting colors, prefer changing the semantic
mapping (e.g. `--muted-foreground`) over the raw brand token (e.g. `--grey-text`) — the brand token may be reused
elsewhere against a different background.

## Branding

App name, logos, and theme colors/fonts are configurable at runtime without a rebuild, so the same build can be
deployed under different partner branding. `frontend/public/branding.json` is fetched once at boot
([`src/branding/applyBranding.ts`](frontend/src/branding/applyBranding.ts)) and applied by writing CSS custom
properties onto `:root` (overriding the defaults in `index.css`), plus `document.title`, the meta description, and
the favicon. Read values through the typed getters in `src/branding/brandingConfig.ts` (e.g. `getAppName()`) rather
than hardcoding copy — every getter has a fallback, so a missing/malformed config never breaks rendering.

## Internationalization (i18n)

UI strings go through i18next + react-i18next, not hardcoded literals. Only `en-GB` exists today
(`frontend/src/i18n/locales/en-GB/translation.json`); adding a locale means a new `locales/<locale>/translation.json`
plus one entry each in `SupportedLocales` and `LocalesLabels` (`src/i18n/constants.ts`).

- **Init** (`src/i18n/i18n.ts`) runs after branding loads, in `main.tsx` — it captures the app name as a default
  interpolation variable (`{{appName}}`) available in every translation string.
- **Language detection** is `localStorage` → browser `navigator`, cached to `localStorage` (key `i18nextLng`); there's
  no backend to sync a per-user preference to yet.
- **Typed keys**: `src/i18n/react-i18next.d.ts` derives a `TranslationKey` union from `en-GB/translation.json`'s
  shape, so `t("bad.key")` is a compile error.
- **Consistency test** (`src/i18n/locales/locales.test.ts`) deep-compares every supported locale's key shape against
  the first entry in `SupportedLocales` — catches missing/extra keys the moment a second locale is added.
- **Testing**: unit tests never hit the real i18next instance — `src/test/setup.ts` mocks `react-i18next` via
  `src/i18n/i18nMock.tsx`, which renders the *real* `en-GB` strings synchronously and throws on a missing key (so
  tests assert against real copy, not placeholder keys, without needing async init). Storybook takes the opposite
  approach: `.storybook/preview.tsx` wires the real i18next instance through `I18nextProvider`, with a toolbar
  `globalTypes.locale` dropdown to preview other locales live.
- **Language switcher**: `src/i18n/LanguageSwitcher/LanguageSwitcher.tsx`, in the sidebar footer.

## Error tracking (Sentry)

`src/sentry/sentryInit.ts` initializes `@sentry/react` — first thing in `main.tsx`, before branding/i18n/render, so
errors during boot are still captured. Unlike branding/i18n (fetched/loaded at runtime), Sentry config is read from
build-time Vite env vars (`VITE_SENTRY_ENABLED`, `VITE_SENTRY_DSN`, `VITE_SENTRY_TRACES_SAMPLE_RATE`,
`VITE_TARGET_ENVIRONMENT_NAME` — see `frontend/.env.example`), since a Sentry DSN is tied to a specific
build/deployment rather than something that should be swappable without a rebuild. `VITE_SENTRY_ENABLED` must be
the literal string `"true"` to enable — any other value (including unset) leaves it off, so a local/unconfigured
build never reports.

`Sentry.ErrorBoundary` wraps `<App />` in `main.tsx`, falling back to `src/sentry/ErrorFallback/ErrorFallback.tsx` on an uncaught
render error. This is intentionally a minimal core setup (init + error boundary only) — no router instrumentation
(no router exists yet), no feedback widget, no sourcemap upload pipeline. Add those later if/when they're needed,
following compass's `frontend-new/src/sentryInit.ts` for reference, but note compass's setup includes some
product-specific pieces (a custom Brotli-compressing transport, and a deliberate anti-PII-scrubbing trick for
auth/token log text) that were a deliberate choice *not* to carry over here.

## Backend

FastAPI + Pydantic, modeled on the tooling conventions in the `compass` repo's backend (Poetry, pylint, bandit,
pytest + in-memory Mongo), but scoped down: no LLM/chat code, and a single database instead of compass's four.

- **Entrypoint**: [`backend/app/server.py`](backend/app/server.py) — builds a module-level `ApplicationConfig` from
  environment variables (fails fast with a clear error if a required var is missing), sets it as a process-wide
  singleton (`app/app_config.py`), configures logging and Sentry, then constructs the `FastAPI` app with a
  `lifespan` that connects to Mongo and runs index initialization on startup.
- **Config**: two patterns coexist, matching compass — a hand-built `ApplicationConfig` (plain Pydantic `BaseModel`,
  populated from `os.getenv()` in `server.py`) for app-wide settings, and narrower `pydantic_settings.BaseSettings`
  subclasses (e.g. `common_libs/environment_settings/mongo_db_settings.py`) for settings a specific module owns —
  instantiated lazily so importing the module doesn't require the env vars to already be set.
- **Database**: `AnalyticsDBProvider` (`app/server_dependencies/db_dependencies.py`) is a lazily-initialized,
  async-lock-guarded singleton wrapping a single Motor `AsyncIOMotorDatabase` — `get_db()`, `initialize_mongo_db()`
  (idempotent index creation, called on startup and from test fixtures), `clear_cache()` (test teardown).
- **Health check**: `GET /version` (`app/version/`) doubles as the health/readiness endpoint, returning build info
  (`VersionInfo`). There's no separate `/health` route — this is the same pattern compass uses, and what the smoke
  test and any future deploy pipeline should poll.
- **Logging**: structured JSON in production (`app/logging.cfg.yaml`, via `app/logger.py`'s `JsonLogFormatter`),
  human-readable console + rotating file in dev (`app/logging.cfg.dev.yaml`). A `SessionIdLogFilter` injects
  request-scoped `session_id`/`user_id` from `contextvars` (`app/context_vars.py`) into every log record.
- **Testing**: colocated `*_test.py` files next to source, not a separate `tests/` directory. Root `conftest.py`
  provides `in_memory_analytics_database` (a real, ephemeral MongoDB via `pymongo_inmemory`, not a mock) and
  `setup_application_config`. A `smoke_test` marker (`pytest -m "not smoke_test"` to exclude) is reserved for tests
  that hit a *deployed* environment, e.g. `smoke_test/test_version.py` checking `/version` matches an expected build.
- **Linting**: `poetry run pylint --exit-zero --recursive=y .` (informational — CI never fails on lint findings,
  same as compass) and `poetry run bandit -c bandit.yaml -r .` (security scan, this one blocks). No auto-formatter —
  style is enforced by convention (160-char line length in `.pylintrc`), matching compass exactly.
- **Docker**: two-stage build (`backend/Dockerfile`) — Poetry installs production deps only in the builder stage,
  the final `python:3.11-slim` image just copies `site-packages` + `app/` + `common_libs/` and runs
  `uvicorn app.server:app`.

## Testing

- **Unit tests** (`frontend/src/**/*.test.tsx`) run under jsdom via `yarn test`, with MSW's Node server intercepting
  any network calls (`frontend/src/mocks/`).
- **Component tests** are Storybook stories (`*.stories.tsx`) run as real-browser Vitest tests via `yarn test:storybook`
  (Playwright/Chromium), using the same MSW handlers through `msw-storybook-addon`.
- **Accessibility** is gated via `yarn test:accessibility`, which runs the same story suite with axe assertions set
  to fail (`a11y.test: 'error'`) instead of the lenient `'todo'` used locally.
- See [testing-guidelines.md](testing-guidelines.md) for BDD test-writing conventions and
  [snapshot-testing-guidelines.md](snapshot-testing-guidelines.md) for when snapshot tests are appropriate.

## CI/CD (`.github/workflows/`)

### Pipeline Flow

Every push runs, in parallel: Frontend CI (format check, lint, compile, unit tests, Storybook tests, build) with a
separate Accessibility job (Storybook tests with axe assertions set to fail), and Backend CI (bandit, pylint, pytest,
Docker build). There is no deploy pipeline yet — `iac/` and a hosting target haven't been decided.

### Key Workflows

| File               | Purpose                                    |
| ------------------ | ------------------------------------------- |
| `main.yml`         | Orchestrates CI jobs on every push           |
| `frontend-ci.yml`  | Frontend checks (test job + accessibility job) |
| `backend-ci.yml`   | Backend checks (bandit, pylint, pytest, Docker build) |

## Development Guidelines

### File Organization

- shadcn/ui primitives live in `frontend/src/components/ui/`; app-specific components live alongside them under
  `frontend/src/components/`.
- Every component should have a colocated `*.stories.tsx` file.
- MSW request handlers are centralized in `frontend/src/mocks/handlers.ts` and shared between the app's dev-time
  worker, Storybook, and Vitest — add new handlers there rather than mocking fetch calls ad hoc.

### Code Style

- TypeScript, formatted with Prettier (`frontend/.prettierrc.json`), linted with oxlint.
- Path alias `@/*` resolves to `frontend/src/*`.

### Environment Variables

- Frontend: see `frontend/.env.example`. No variables are defined yet — Vite only exposes `VITE_`-prefixed vars to
  the client bundle.
- Backend: see `backend/.env.example`, grouped by concern (app identity/CORS, database, observability). Required
  vars are validated at startup in `server.py` — a missing one raises immediately rather than failing later at
  first use.
