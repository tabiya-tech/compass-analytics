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

- **Entrypoint**: [`backend/app/server.py`](backend/app/server.py) builds the `ApplicationConfig`
  from environment variables at module load time (`app/app_config.py`; fails fast with a clear
  error if a required var is missing), sets it as a process-wide singleton, configures Sentry,
  then constructs the module-level `app` with a `lifespan` that connects to Mongo and runs index
  initialization on startup. `uvicorn app.server:app` runs this `app` in production. Because all
  of this happens as a side effect of importing the module, anything else that needs the app
  object — currently just `scripts/export_openapi.py` — has to satisfy the same required env vars
  first (see "Frontend/backend type sync" below).
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

## Frontend/backend type sync

The backend's OpenAPI spec is the single source of truth for API request/response shapes — the
frontend never hand-writes a type that duplicates a backend Pydantic model. This applies to real
wire-format types only (a JSON request/response body); it does not extend to things the backend
has no schema for at all, such as Firebase-derived auth types or a frontend-only UI state shape.

- **Export**: [`backend/scripts/export_openapi.py`](backend/scripts/export_openapi.py) imports
  the real `app.server:app` and dumps `app.openapi()` to a JSON file. Importing `app.server`
  builds its `ApplicationConfig` from environment variables at module load time, failing fast on
  any missing one — even though schema generation itself never touches a live database or
  Firebase — so the script sets dummy values for all of them first (`_DUMMY_ENV`), then reads the
  already-built `app` off the module. This is what lets the script run in CI's
  `build-openapi-spec` job, which has no real secrets, and locally with no `.env` file. If
  `server.py` starts requiring a new environment variable, add a matching dummy value to
  `_DUMMY_ENV`.
- **Generate**: `frontend/src/api-types/schema.d.ts` is produced from that JSON by
  `openapi-typescript` (`yarn run generate:api-types`, in `frontend/package.json`). This file is
  **gitignored, never committed** — every build (CI or local) generates it fresh.
- **Consume via the barrel, not the raw file**: `frontend/src/api-types/index.ts` re-exports
  named aliases (`JobseekerSummary`, `MeResponse`, `AnalyticsParams`, ...) built on top of
  `schema.d.ts`. Domain `*.types.ts` files (e.g. `frontend/src/jobseekers/jobseekers.types.ts`)
  import from this barrel, not from `schema.d.ts` directly, since a few of the raw generated
  shapes need a small fix centralized in one place:
  - **`RequiredDefaultFactoryFields<T, K>`** — a Pydantic field declared
    `= Field(default_factory=list)` comes through the OpenAPI schema as optional, since FastAPI
    can't tell "always sent, defaults to empty" apart from "may be absent." This type re-marks
    such fields required, only after checking the actual Pydantic model uses default_factory —
    never guessed. A genuinely optional field (`Optional[str] = None`) is left alone.
  - A few backend fields are typed looser than what they actually contain (e.g.
    `InstitutionModuleProgress.module_id` is a plain `str` in Pydantic, though its one caller only
    ever populates it from a closed set of module ids) — these are narrowed with a comment citing
    the backend code that guarantees it's safe. A field with no such guarantee (e.g.
    `MeResponse.active_modules`, sourced from an unvalidated deployment env var) is **not**
    narrowed — the frontend filters it against the known set where it enters strictly-typed code
    instead (`AccessContext.tsx`'s `_toKnownModuleIds`).
- **Query parameters have no single request schema to generate**: a `GET` endpoint's parameters
  are individually typed in the spec, not as one component schema, so there's nothing to alias
  for "the request" as a whole. Where the frontend's shape matches the wire params directly
  (`AnalyticsParams`, `DemographicsParams`), the generated parameters type is used as-is. Where
  the frontend needs a richer shape encoded into the wire format at the service boundary
  (jobseekers' filters; the institutions table's search/sort, which run entirely client-side
  since the backend only accepts an `institution_id` filter and always returns the full,
  unsorted portfolio — see `frontend/src/pages/Institutions/Institutions.tsx`), there's no named
  "query" type standing between the two — only the individual field vocabularies
  (`JobseekerSortKey`, `ModuleStatus`, ...) are generated.

### Local workflow

`backend/build/openapi.json` and `frontend/src/api-types/schema.d.ts` are both gitignored — a
fresh clone starts with neither. `yarn dev` regenerates both automatically first, via a `predev`
hook (`poetry install`, in case backend deps aren't set up yet, then the export and codegen
below) — so cloning and running `yarn dev` just works, with no manual step, at the cost of a few
extra seconds on every `yarn dev` and a Poetry/Python dependency on that command.

To regenerate without starting the dev server (e.g. before `yarn compile`/`yarn test` mid-edit,
or after changing a backend model without restarting `yarn dev`):

```
cd backend && poetry run python -m scripts.export_openapi --output build/openapi.json
cd frontend && yarn run generate:api-types
```

`run-before-merge.sh`'s frontend option also runs both automatically. If you're only iterating on
the frontend and the backend contract hasn't changed, `yarn run generate:api-types` alone also
works against a spec exported earlier in the session — the schema only needs to be re-exported
after a backend model/route change.

### Adding a new backend type

1. Add the field/model to the Pydantic type or route as normal — no special handling needed.
2. Re-run the two commands above to regenerate `schema.d.ts`.
3. If the frontend needs the new type, alias it once in `frontend/src/api-types/index.ts`:
   `export type YourNewType = components["schemas"]["YourNewType"];` — only alias types actually
   consumed, not everything in the spec.
4. Re-export it from the relevant domain `*.types.ts` file (e.g.
   `frontend/src/jobseekers/jobseekers.types.ts`), not `schema.d.ts` directly.
5. Update whatever service/component needs the new field. For an existing type, `yarn compile`
   will fail at every call site a new required field breaks — that's the mechanism working, not
   a bug to work around.
6. If the new field is a Pydantic `Field(default_factory=list|dict)`, check whether it needs
   wrapping in `RequiredDefaultFactoryFields` (see above) — the generated schema marks it
   optional even though the backend always sends it.

### CI enforcement

[`build-openapi-spec.yml`](.github/workflows/build-openapi-spec.yml) exports the spec once, in
its own job, and [`frontend-ci.yml`](.github/workflows/frontend-ci.yml) downloads it and
regenerates `schema.d.ts` before `Compile`/`Unit tests`/`Storybook tests`/`Build`. There's no
separate "types are in sync" check — regenerating unconditionally, before every other step,
means a backend shape change with no matching frontend update just fails `Compile` at the call
site, on the same PR. `build-openapi-spec` is kept separate from `backend-ci` (bandit, pylint,
pytest, Docker build) so `frontend-ci` only waits on the small, fast export.

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

Every push first runs `build-openapi-spec` (exports the backend's OpenAPI schema as an artifact — see
"Frontend/backend type sync" above), then in parallel: Frontend CI (waits on `build-openapi-spec`;
generates API types, format check, lint, compile, unit tests, Storybook tests, build) with a
separate Accessibility job (also waits on `build-openapi-spec`; Storybook tests with axe assertions set
to fail), and Backend CI (bandit, pylint, pytest, Docker build — does not wait on `build-openapi-spec`).

### Key Workflows

| File                | Purpose                                                         |
| ------------------- | ---------------------------------------------------------------- |
| `main.yml`          | Orchestrates CI jobs on every push                                |
| `build-openapi-spec.yml`  | Exports the backend's OpenAPI schema as a shared artifact          |
| `frontend-ci.yml`   | Frontend checks (test job + accessibility job); generates API types from the `build-openapi-spec` artifact before compiling |
| `backend-ci.yml`    | Backend checks (bandit, pylint, pytest, Docker build)             |

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
- **`data-testid`s are UUID-suffixed, on purpose — keep it.** Every component defines a module-level
  `const uniqueId = "<uuid>"` and builds its test ids as `` `foo-${uniqueId}` `` via a `DATA_TEST_ID` map (see
  `Overview.tsx`, `Login.tsx`, and the `auth/components/*`). The UUID guards against silent test-id collisions: if a
  component is copy-pasted (or two components pick the same human-readable id), the tests can't accidentally match the
  wrong element and pass for the wrong reason. This looks like noise but is deliberate — do **not** strip it, and give
  every new component its own fresh `uniqueId` (a new UUID, not a copied one — copying defeats the point).

### Environment Variables

- Frontend: see `frontend/.env.example`. No variables are defined yet — Vite only exposes `VITE_`-prefixed vars to
  the client bundle.
- Backend: see `backend/.env.example`, grouped by concern (app identity/CORS, database, observability). Required
  vars are validated at startup in `server.py` — a missing one raises immediately rather than failing later at
  first use.
