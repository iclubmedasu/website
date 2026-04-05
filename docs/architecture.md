# System Architecture
 
## Overview
 
iClub Platform is a monorepo containing three applications sharing a common type system.
 
## Structure
 
```
website/
├── backend/          Express API + Prisma ORM
├── members-portal/   React/Vite frontend (members only)
├── public-website/   Next.js public website
└── packages/
    └── shared/       Shared TypeScript types
```
 
## Technology Stack
 
| Layer | Technology |
|-------|------------|
| Frontend (Portal) | React, TypeScript, Vite |
| Frontend (Public) | Next.js, TypeScript |
| Backend | Express, TypeScript, Prisma |
| Database | PostgreSQL |
| File Storage | GitHub API |
| Auth | JWT with httpOnly cookies |
| Package Manager | pnpm workspaces |
 
## Authentication Flow
 
1. User submits login credentials
2. Backend validates and issues JWT
3. JWT stored in httpOnly cookie (not localStorage)
4. All subsequent requests include cookie automatically
5. Backend middleware validates cookie on protected routes
 
## Data Flow
 
Frontend → API Service (api.ts) → Express Backend → Prisma → PostgreSQL
