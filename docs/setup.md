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
   - Copy `backend/.env.example` → `backend/.env`
   - Copy `members-portal/.env.local.example` → `members-portal/.env.local`
   - Copy `public-website/.env.local.example` → `public-website/.env.local`
4. Fill in all environment variables (see each `.env.example` / `.env.local.example` for descriptions). Production URLs live in Hugging Face Space settings — see [deployment.md](deployment.md).
5. Install all dependencies from the root:
   ```
   pnpm install
   ```
6. Set up the database:
   ```
   pnpm --filter backend prisma:migrate
   ```
   This runs Prisma migrations and automatically enables Row-Level Security on all `public` tables (required for Supabase).
7. Start all services:
   ```
   pnpm dev
   ```
 
## Services
- Backend API: http://localhost:3000
- Members Portal: http://localhost:3001
- Public Website: http://localhost:3002

Public event registration confirmation URLs:
`http://localhost:3002/events/{eventId}/confirmation?code={confirmationCode}`

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

## PWA Development Notes

### Testing PWA locally

Service workers are disabled in development mode to avoid
caching issues. To test PWA features locally:

```bash
# Build the production version
pnpm --filter members-portal build

# Preview the production build (service worker active)
pnpm --filter members-portal start
```

Then visit http://localhost:3001 in Chrome.
Open DevTools -> Application -> Service Workers
to verify the service worker is registered.

### Generating PWA icons

1. Visit realfavicongenerator.net
2. Upload your iclub logo (high resolution PNG)
3. Download the generated package
4. Rename files to match icon-[size]x[size].png format
5. Place in members-portal/public/icons/

### Capturing PWA screenshots

```bash
# Start the portal first
pnpm dev:portal

# In another terminal, run the screenshot script
pnpm --filter members-portal pwa:screenshots
```

### Testing on mobile

For real device testing over your local network:

```bash
# Find your local IP address
# Windows: ipconfig
# Mac: ifconfig | grep inet

# Start portal accessible on network
pnpm --filter members-portal dev -- --hostname 0.0.0.0
```

Then on your phone, visit http://[your-local-ip]:3001
Note: Service worker requires HTTPS on real devices.
Use a tool like ngrok for HTTPS tunnel during testing.

### iOS install instructions for members

Since iOS does not auto-prompt, share these steps with members:
1. Open the portal in Safari (not Chrome)
2. Tap the Share button (rectangle with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" to confirm
