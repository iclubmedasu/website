# iClub Platform Architectural Summary

Generated: 2026-07-27  
Source: current workspace snapshot

## Scope

This summary describes the current architecture of the iClub platform, grouped by application boundaries and runtime responsibilities. It reflects source structure and config in the workspace and excludes generated/noise folders (`node_modules`, `.next`, `dist`, `coverage`, etc.).

## 1) Platform Topology

| Layer | Component | Runtime | Default Port | Primary Responsibility |
|---|---|---|---|---|
| API | `backend` | Node.js + Express 5 | `3000` | Auth, personnel, projects, events, certificates, finance, site CMS, public API |
| Internal Web App | `members-portal` | Next.js App Router (v15) | `3001` | Authenticated members experience + PWA shell |
| Public Web App | `public-website` | Next.js App Router (v16) | `3002` | Public-facing website (events, projects, members, verify) |
| Shared Contracts | `packages/shared` | TypeScript package | N/A | Shared types and datetime/certificate utilities |
| Data | PostgreSQL | PostgreSQL 16 | `5432` | System of record for operational data |

## 2) Monorepo Boundary Model

The repository is a pnpm workspace with four package scopes:

- `backend`
- `members-portal`
- `public-website`
- `packages/*`

Root orchestration scripts run all three applications in parallel for local development (`dev`) and provide split commands (`dev:api`, `dev:portal`, `dev:web`).

## 3) Members Portal Architecture

### 3.1 Routing and Access Segmentation

The portal uses Next App Router route groups:

- `src/app/(public)` — login flow and unauthenticated layout boundary
- `src/app/(protected)` — authenticated sections:
  - `dashboard` — member overview widgets
  - `teams`, `members`, `alumni`, `administration` — personnel
  - `projects`, `past-projects` — project lifecycle
  - `events`, `past-events`, `events/new`, `events/[id]/*` — event management, check-in, registrations
  - `certificates`, `certificates/templates/*` — certificate hub and template editor
  - `finance` — finance dashboard
  - `help`, `general/about`, `general/contact`, `general/support` — help and site content editors
  - `user` — profile, privacy, notifications, security

### 3.2 Layout and Gate Stack

The protected layout composes guard layers in this order:

1. `AuthGuard`
2. `AlumniGate`
3. `UnassignedGate`
4. `SideBarNavigationSlim` shell

At root layout level, `AuthProvider` is mounted globally and `PWAInstallPrompt` is appended after app content. `RealtimeProvider` delivers live notification updates.

### 3.3 Architectural Layers in `src`

- `app/` — route entrypoints and layouts
- `components/` — reusable UI, guards, providers
- `features/` — domain screens (Dashboard, Events, Projects, Certificates, Finance, Personnel, SiteContent, HelpAndSupport)
- `hooks/` — cross-feature hooks
- `services/` — API clients
- `types/` — app-local type interfaces
- `utils/` — pure utilities

### 3.4 PWA Integration

The members portal includes service-worker assets and PWA configuration:

- `public/manifest.json`
- `public/sw.js`
- `next-pwa` integration in `next.config.ts`

`next.config.ts` uses `output: 'standalone'` and includes remote image patterns for API-hosted profile/photo endpoints.

## 4) Public Website Architecture

The public website is a full Next.js App Router application (no longer a stub):

### 4.1 Routes

- `/` — home (hero, highlights, upcoming events/projects)
- `/events`, `/events/[id]`, `/events/[id]/register`, `/events/[id]/join`, `/events/[id]/confirmation`
- `/projects`, `/projects/[id]`
- `/members`, `/members/[id]`
- `/about`, `/contact`, `/support`
- `/verify/[code]` — public certificate verification

### 4.2 Component Organization

- `components/home`, `events`, `projects`, `members`, `registration`, `certificates`, `support`, `layout`
- `components/public-data` — page content wrappers fetching from the public API
- `lib/` — site config, API helpers, formatting

Data is served by the backend `/api/public` routes; the public site does not connect to the database directly.

## 5) Backend Architecture

### 5.1 Runtime

- Express 5 API service (`server.ts`)
- Prisma ORM with PostgreSQL adapter
- Cookie parsing, CORS, and rate limiting for web ports
- WebSocket endpoint for realtime notifications

### 5.2 API Domain Modules

The API is modularized by route domain under `/api`:

| Domain | Routes module | Purpose |
|--------|---------------|---------|
| Auth | `auth` | Login, setup-password, profile completion, me, logout |
| Public | `public` | Public events, projects, members, site content, registration |
| Personnel | `members`, `teams`, `teamMembers`, `teamRoles`, `teamSubteams`, `roleHistory`, `alumni`, `administration` | Directory, teams, roles, admin |
| Projects | `projects`, `phases`, `tasks`, `scheduleSlots`, `projectFiles` | PM lifecycle, WBS, files |
| Events | `events`, `eventFiles`, `eventPhotos` | Event lifecycle, registrations, check-in, photos |
| Certificates | `certificates`, `certificateTemplates` | Issue, verify, templates, PDF/email |
| Finance | `finance` | Accounts, transactions, liabilities, scheduled items |
| CMS | `siteContent`, `supportContent` | About/Contact editors, support notices, incident reports |
| Dashboard | `dashboard` | Portal dashboard aggregates |
| Notifications | `notifications` | In-app notifications + unread counts |

### 5.3 Auth and Authorization Model

- Primary session token is a JWT from cookie `token` (with bearer header fallback).
- `authenticateToken` injects decoded user claims into `req.user`.
- `requireAdmin` enforces developer/admin checks via Administration team membership.
- Domain-specific permission helpers in `backend/lib/` (events, finance, support, member visibility).

### 5.4 External Integrations

- **GitHub storage** — profile photos, project/event files, certificate backgrounds, event photo galleries
- **Email** — event tickets, certificate delivery, contact/incident forms
- **Supabase RLS** (optional) — public read-path hardening via `backend/scripts/enablePublicRls.ts`

## 6) Data and Contract Architecture

### 6.1 Data Plane

- PostgreSQL is the primary relational store.
- Prisma schema/migrations and generated client drive persistence.
- Core domains: members, teams/roles/subteams, projects/phases/tasks, events/registrations/sessions, certificates, finance, site/support content, notifications, activity logs.

### 6.2 Contract Plane

`@iclub/shared` provides shared TypeScript types and utilities (datetime formatting, certificate wording, club-local timezone helpers) used across backend and frontend boundaries.

## 7) Runtime and Deployment Topology

### 7.1 Local Runtime Ports

- API: `3000`
- Members portal: `3001`
- Public website: `3002`
- Postgres: `5432`

### 7.2 Docker Compose Coverage

Current `docker-compose.yml` defines:

- `db` (PostgreSQL)
- `api` (backend)
- `portal` (members portal)

The public website can be run locally via `pnpm dev:web` but is not yet included in compose services.

## 8) Testing and Quality Architecture

Root-level quality pipeline includes:

- Type checks per package (`typecheck`)
- Unit/integration tests via Vitest (`test`, `test:run`, `test:coverage`)
- E2E tests via Playwright (`test:e2e`)
- ESLint + Prettier workflows
- GitHub Actions: `ci.yml`, `deploy.yml`, `gitleaks.yml`, `semgrep.yml`

Package-level tests exist under `backend/__tests__`, `members-portal` feature tests, `public-website`, and `packages/shared`.

## 9) Documentation Layout

```
docs/
├── README.md
├── setup.md, deployment.md, api.md
├── architecture.md, architectural_summary.md, project_structure.md
├── css-standards.md
├── user-guide.md              # non-technical feature guide
└── security/
    ├── security.md            # strategy and threat model
    ├── security-pentest.md    # pentest runbook
    └── shannon-iclub.example.yaml
```

## 10) Architectural Follow-Up Suggestions

1. Add `public-website` service to `docker-compose.yml` for local full-stack parity.
2. Consider aligning Next.js major versions across portal and public site when operationally feasible.
3. Document domain ownership per backend route module in short ADRs for large refactors.
