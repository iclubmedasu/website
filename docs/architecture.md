# System Architecture

## Overview

iClub Platform is a pnpm monorepo with three applications and a shared TypeScript package. It serves **iClub, MED-ASU** — the Innovation Club at the Faculty of Medicine, Ain Shams University.

## Structure

```
website/
├── backend/          Express API + Prisma ORM
├── members-portal/   Next.js App Router (authenticated members + PWA)
├── public-website/   Next.js App Router (public-facing site)
├── packages/
│   └── shared/       Shared TypeScript types and utilities
├── docs/             Developer and user documentation
├── scripts/          Repo utilities (security checks, datetime audit)
└── e2e/              Playwright smoke tests
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend (Portal) | Next.js 15, React 19, TypeScript, PWA (`next-pwa`) |
| Frontend (Public) | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Backend | Express 5, TypeScript, Prisma 7 |
| Database | PostgreSQL 16 |
| File Storage | GitHub API (profile photos, project/event files, certificates) |
| Auth | JWT in httpOnly cookies (Bearer header fallback) |
| Realtime | WebSocket notifications |
| Email | Transactional email (tickets, certificates, contact forms) |
| Package Manager | pnpm workspaces |

## Applications

| App | Description | Default Port |
|-----|-------------|--------------|
| Backend API | REST API for portal, public site, and admin flows | `3000` |
| Members Portal | Private portal for club members (projects, events, finance, certificates) | `3001` |
| Public Website | Public club website (events, projects, members, verification) | `3002` |

## Authentication Flow

1. User submits login credentials on the members portal
2. Backend validates credentials and issues a JWT
3. JWT is stored in an httpOnly cookie (not localStorage)
4. Subsequent requests include the cookie automatically
5. Backend middleware validates the token on protected routes
6. Route guards in the portal enforce assignment status, alumni status, and role-based access

## Data Flow

```
Public Website / Members Portal
        ↓
   API client (fetch)
        ↓
   Express Backend (/api/*)
        ↓
   Prisma ORM
        ↓
   PostgreSQL
```

External integrations: GitHub (file storage), email provider (notifications/tickets), optional Supabase RLS for public read paths.

## Related Docs

- [Architectural Summary](./architectural_summary.md) — detailed topology and domain modules
- [Project Structure](./project_structure.md) — filtered directory tree
- [API Reference](./api.md)
- [Deployment](./deployment.md)
