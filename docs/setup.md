# Local Setup Guide
 
## Prerequisites
- Node.js 20 or higher
- pnpm 8 or higher (install with: npm install -g pnpm)
- PostgreSQL database
- Git
 
## Installation
 
1. Clone the repository
2. Navigate to the website/ folder
3. Copy environment files:
   - Copy .env.example to .env
   - Copy backend/.env.example to backend/.env (if exists)
   - Copy members-portal/.env.example to members-portal/.env.local (if exists)
4. Fill in all environment variables (see .env.example for descriptions)
5. Install all dependencies from the root:
   ```
   pnpm install
   ```
6. Set up the database:
   ```
   pnpm --filter backend prisma migrate dev
   ```
7. Start all services:
   ```
   pnpm dev
   ```
 
## Services
- Backend API: http://localhost:3000
- Members Portal: http://localhost:3001
- Public Website: http://localhost:3002
 
## Individual Services
```
pnpm dev:api      # Backend only
pnpm dev:portal   # Members portal only
pnpm dev:web      # Public website only
```

## Running E2E Tests

Playwright tests run from the workspace root.

```bash
pnpm test:e2e
```

Optional variants:

```bash
pnpm test:e2e:headed
pnpm test:e2e:ui
```

Current auth smoke tests use mocked auth API responses in Playwright for deterministic runs and do not require a live backend database.

Recommended `.env` values for auth smoke scenarios:

- `TEST_EMAIL`
- `TEST_PASSWORD`

Optional Playwright runtime overrides:

- `PLAYWRIGHT_BASE_URL` (use an already-running frontend URL)
- `PLAYWRIGHT_PORT` (port for auto-started frontend when base URL is not set)
