# iClub Platform Architectural Summary

Generated: 2026-04-05
Source: current remastered workspace snapshot

## Scope

This summary describes the current architecture after the remaster, grouped by application boundaries and runtime responsibilities.
It reflects source structure and config in the workspace and intentionally excludes generated/noise folders from analysis (`node_modules`, `.next`, `dist`, `coverage`, etc.).

## 1) Platform Topology

| Layer | Component | Runtime | Default Port | Primary Responsibility |
|---|---|---|---|---|
| API | `backend` | Node.js + Express 5 | `3000` | Auth, personnel, projects, tasks, files, scheduling APIs |
| Internal Web App | `members-portal` | Next.js App Router (v15) | `3001` | Authenticated members experience + PWA shell |
| Public Web App | `public-website` | Next.js App Router (v16) | `3002` | Public-facing website |
| Shared Contracts | `packages/shared` | TypeScript package | N/A | Shared types/contracts consumed by apps |
| Data | PostgreSQL | PostgreSQL 16 | `5432` | System of record for operational data |

## 2) Monorepo Boundary Model

The repository is a pnpm workspace with four package scopes:

- `backend`
- `members-portal`
- `public-website`
- `packages/*`

Root orchestration scripts run all three applications in parallel for local development (`dev`) and provide split commands (`dev:api`, `dev:portal`, `dev:web`).

## 3) Members Portal Architecture (Remastered)

### 3.1 Routing and Access Segmentation

The portal is now structured around Next App Router route groups:

- `src/app/(public)`
  - Login flow and unauthenticated layout boundary.
- `src/app/(protected)`
  - Main authenticated sections:
    - administration
    - alumni
    - dashboard
    - help
    - members
    - past-projects
    - projects
    - teams
    - user

### 3.2 Layout and Gate Stack

The protected layout composes guard layers in this order:

1. `AuthGuard`
2. `AlumniGate`
3. `UnassignedGate`
4. `SideBarNavigationSlim` shell

At root layout level, `AuthProvider` is mounted globally and `PWAInstallPrompt` is appended after app content.

### 3.3 Architectural Layers in `src`

The remaster separates concerns into clear boundaries:

- `app/` for route entrypoints and layouts
- `components/` for reusable UI/guards/providers
- `features/` for domain screens and feature modules
- `hooks/` for cross-feature hooks
- `services/` for API clients
- `types/` for app-local type interfaces
- `utils/` for pure utilities

### 3.4 PWA Integration

The members portal includes service-worker assets and PWA configuration:

- `public/manifest.json`
- `public/sw.js`
- `next-pwa` integration in `next.config.ts`

`next.config.ts` uses `output: 'standalone'` and includes remote image patterns for API-hosted profile/photo endpoints.

## 4) Backend Architecture

### 4.1 Runtime

- Express 5 API service (`server.ts`)
- Prisma ORM with PostgreSQL adapter (`@prisma/adapter-pg`)
- Cookie parsing and CORS enabled for local web ports

### 4.2 API Domain Modules

The API is modularized by route domain under `/api`:

- `/auth`
- `/teams`
- `/members`
- `/team-members`
- `/team-roles`
- `/team-subteams`
- `/role-history`
- `/alumni`
- `/administration`
- `/projects`
- `/tasks`
- `/phases`
- `/schedule-slots`
- `/project-files`

### 4.3 Auth and Authorization Model

- Primary session token is a JWT from cookie `token` (with bearer header fallback).
- `authenticateToken` injects decoded user claims into `req.user`.
- `requireAdmin` enforces developer/admin checks via Administration team membership.
- Privilege signals are role-aware and propagated to route handlers.

### 4.4 External Storage Integrations

Two GitHub-backed storage paths exist in services:

- Profile photo proxy and cache behavior (`githubStorage.ts`)
- Project file upload/versioning/history flows (`githubStorageService.ts`)

## 5) Data and Contract Architecture

### 5.1 Data Plane

- PostgreSQL is the primary relational store.
- Prisma schema/migrations and generated client drive persistence.
- Core domains include members, teams/roles/subteams, projects/phases/tasks, schedules, and activity logs.

### 5.2 Contract Plane

`@iclub/shared` provides shared TypeScript types used across backend and frontend package boundaries, reducing drift between API payloads and UI models.

## 6) Runtime and Deployment Topology

### 6.1 Local Runtime Ports

- API: `3000`
- Members portal: `3001`
- Public website: `3002`
- Postgres: `5432`

### 6.2 Docker Compose Coverage

Current `docker-compose.yml` defines:

- `db` (PostgreSQL)
- `api` (backend)
- `portal` (members portal)

The public website is currently not included in compose services.

## 7) Testing and Quality Architecture

Root-level quality pipeline includes:

- Type checks per package (`typecheck`)
- Unit/integration tests via Vitest (`test`, `test:run`, `test:coverage`)
- E2E tests via Playwright (`test:e2e`)
- ESLint + Prettier workflows

Package-level tests are also present (backend and public website scripts), with shared type tests under `packages/shared`.

## 8) Notable Remastering Outcomes

Compared with the prior structure baseline, the remaster introduces or solidifies:

- Migration of members portal to App Router route-group architecture.
- Protected/public route boundary enforcement at layout level.
- Stronger component boundaries (`AuthGuard`, providers, install prompt, sidebar shell).
- PWA-ready portal packaging and service-worker assets.
- Cleaner feature-layer separation (`features`, `hooks`, `services`, `utils`).

## 9) Architectural Follow-Up Suggestions

1. Align Next.js major versions across `members-portal` and `public-website` if operationally feasible.
2. Add `public-website` service to `docker-compose.yml` if local full-stack parity is required.
3. Consider a short ADR (Architecture Decision Record) capturing why auth guards are split across `AuthGuard`, `AlumniGate`, and `UnassignedGate`.
4. Document domain ownership per backend route module to ease future large refactors.
