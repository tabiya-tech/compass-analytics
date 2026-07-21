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
├── backend/           # Not yet implemented
└── iac/               # Not yet implemented
```

There is no root-level orchestration tool (no Turborepo/Nx) — each subproject is a self-contained package with its
own `package.json` and tooling, wired together only by the root [`run-before-merge.sh`](run-before-merge.sh) script.

## Tech Stack

| Layer          | Technology                                                             |
| -------------- | ----------------------------------------------------------------------|
| Frontend build | Vite, React 19, TypeScript                                             |
| Styling        | Tailwind CSS v4 + shadcn/ui (Radix primitives), Tabiya design tokens    |
| Component dev  | Storybook 10 (`@storybook/addon-vitest`, `@storybook/addon-a11y`)       |
| Testing        | Vitest (jsdom "unit" project + browser-mode "storybook" project), Testing Library, MSW |
| Linting        | oxlint                                                                  |
| Formatting     | Prettier                                                                |
| Backend        | Not yet decided                                                        |
| Infrastructure | Not yet decided                                                        |

## Design System

The UI is built on Tabiya's shared design tokens (Oxford/Tabiya Blue `#002147`, Tabiya Green `#00FF91`, DM Sans/DM
Mono), wired into Tailwind v4's `@theme inline` and mapped onto shadcn's semantic CSS variables in
[`frontend/src/index.css`](frontend/src/index.css). When adjusting colors, prefer changing the semantic
mapping (e.g. `--muted-foreground`) over the raw brand token (e.g. `--grey-text`) — the brand token may be reused
elsewhere against a different background.

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

Every push runs Frontend CI (format check, lint, compile, unit tests, Storybook tests, build) and a separate
Accessibility job (Storybook tests with axe assertions set to fail) in parallel. There is no deploy pipeline yet —
`iac/` and a hosting target haven't been decided.

### Key Workflows

| File               | Purpose                                    |
| ------------------ | ------------------------------------------- |
| `main.yml`         | Orchestrates CI jobs on every push           |
| `frontend-ci.yml`  | Frontend checks (test job + accessibility job) |

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
