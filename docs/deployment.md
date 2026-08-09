# Deployment Guide

## Overview

This project is deployed using GitHub Actions, with the following services.

**Current deploy targets** (Hugging Face Space URLs — live today):

| Service           | Purpose                | Provider/URL |
|-------------------|------------------------|--------------|
| Backend API       | Node.js API            | [Hugging Face Spaces](https://huggingface.co/spaces/iclubmedasu/backend) ([API](https://iclubmedasu-backend.hf.space/api), [Health](https://iclubmedasu-backend.hf.space/health)) |
| Database          | PostgreSQL             | [Supabase](https://supabase.com/) |
| Members Portal    | Next.js Node.js app    | [Hugging Face Spaces](https://huggingface.co/spaces/iclubmedasu/members-portal) ([Live site](https://iclubmedasu-members-portal.hf.space)) |
| Public Website    | Next.js Node.js app    | [Hugging Face Spaces](https://huggingface.co/spaces/iclubmedasu/public-website) ([Live site](https://iclubmedasu-public-website.hf.space)) |

Custom website hostnames (`iclubmedasu.com`, `members-portal.…`) are **deferred** — HF custom domains require a paid HF plan. Sites stay on `*.hf.space` for now; branded email From (`noreply@iclubmedasu.com`) still works via Resend.

## Deployment Flow

1. **CI**: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on push/PR to `main` and `develop` (lint, typecheck, tests, builds). Backend build failures fail CI.
2. **Deploy**: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) runs after CI **completes successfully** (`workflow_run` on `main`’s CI, or manual `workflow_dispatch`). Concurrency group `production-deploy` prevents overlapping production deploys. Jobs use the GitHub **`production`** environment (add required reviewers under Settings → Environments if you want a human pause before migrate/upload).
3. **Database**: Managed by Supabase. Prisma migrations + support-content seed run **first** against `DATABASE_URL`.
4. **Backend**: Hugging Face Docker Space upload + health check (+ optional auto-revert).
5. **Members portal / public website**: Same pattern for their Spaces.

Health check URLs default to the `iclubmedasu-*.hf.space` paths below; override with repository variables `BACKEND_HEALTH_URL`, `FRONTEND_HEALTH_URL`, or `PUBLIC_HEALTH_URL` if Spaces move.

### Rollback and migration safety

- **Space auto-revert** restores only **code** from movable `deployed-*` tags when a post-upload **health** check fails. It does **not** reverse Prisma migrations or seeds.
- Migrations are **forward-only**. Prefer additive schema (new columns/tables) so old and new app versions can share the expanded schema. Destructive changes need a deliberate multi-step release and, if rolled back in the app, a **manual compensating migration** on Supabase — CI will not do it for you.
- The `production` environment approval gate (when configured) is the intended human checkpoint before a risky migrate+deploy lands.
- **HF cold starts:** after idle scale-to-zero or a rebuild, the first requests may receive HTML or temporary 429 interstitials instead of JSON. The members portal parses API bodies defensively and shows a short “try again” message rather than a raw JSON parse error.

### Hugging Face Spaces — CI upload only (no `create_repo`)

Docker Spaces must be **created once manually** on Hugging Face (Settings → New Space → Docker SDK). The deploy workflow only **uploads** files via `huggingface_hub`; it does **not** call `create_repo`.

**Why:** Hugging Face returns `402 Payment Required` when creating Docker Spaces via API without a [PRO subscription](https://huggingface.co/pro). Static Spaces are free; Docker/Gradio Spaces on `cpu-basic` require PRO to create through the API. Uploading to an **existing** Space does not require PRO.

**First-time setup:**

1. Create three Docker Spaces on HF: `backend`, `members-portal`, `public-website` (under your org e.g. `iclubmedasu/`).
2. Set GitHub secrets `HF_SPACE`, `HF_FRONTEND_SPACE`, `HF_PUBLIC_SPACE` to those paths.
3. Push to `main` so CI can go green, then deploy runs (or use **workflow_dispatch** once secrets are set).

**If deploy fails with 402:** Your Spaces already exist; ensure the workflow does not call `create_repo` (upload-only). If you need a **new** Docker Space, create it in the HF web UI or subscribe to PRO.

## Deploy safety net (health check + auto-revert)

After each Space upload, [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) waits for the container to rebuild and checks a health endpoint:

| Target | Health URL |
|--------|------------|
| Backend | `https://iclubmedasu-backend.hf.space/health` |
| Members portal | `https://iclubmedasu-members-portal.hf.space/api/health` |
| Public website | `https://iclubmedasu-public-website.hf.space/api/health` |

**On success:** the workflow force-moves a git tag for that target to the current monorepo commit:

- `deployed-backend`
- `deployed-frontend`
- `deployed-public`

That tag is the **last known-good** monorepo SHA for that Space.

**On health-check failure:** the job re-uploads the file tree from the last known-good tag (same prepare/upload steps as a normal deploy) as a new HF Space commit titled `Auto-revert: …`, then **exits with failure** so you get notified. Hugging Face has no native “rollback API”; the restore is a normal non-destructive new commit.

### What auto-revert does **not** do (database)

- Auto-revert **only** restores **Space code**. It never rolls back Supabase / Prisma migrations.
- Migrations still run **first** (`migrate` job), before the three deploy jobs. Keep migrations **additive only** (new tables/columns; do not rename/drop columns that old code still needs in the same release). Old and new app versions can then share one expanded schema.
- If you must ship a **destructive** schema change, do it in a planned multi-step release (expand → migrate app → contract later). Do not rely on auto-revert; fix by hand and treat the failed job as a loud alarm.

### Notifications (GitHub failure email)

There is no custom Slack/Resend step. A failed deploy (including after a successful auto-revert of the Space) fails the Actions job so GitHub can email you.

**Confirm once on your account:**

1. GitHub → avatar → **Settings** → **Notifications** → **Actions** — enable email for workflow failures (or “Failed workflows that I start / that affect me”, depending on current UI labels).
2. For the repo: ensure you **Watch** it (or are an owner) and that notification email is verified.
3. Optional: repo **Settings** → **Notifications** / personal **Custom routing** if org mail goes elsewhere.

### First successful run after enabling this workflow

Until each `deployed-*` tag exists, a failed health check **cannot** auto-revert (it fails loudly and asks for a manual fix). After the first **healthy** deploy of each job, tags are created and auto-revert works on later failures.

### How to deliberately test auto-revert (before trusting it)

Do this only when you can watch Actions and the Spaces for a few minutes:

1. Confirm tags already exist after at least one green full deploy: `git ls-remote --tags origin 'deployed-*'`.
2. On a short-lived branch (or a one-line PR to `main` you control): make **one** health route fail — e.g. temporary `return new Response('fail', { status: 503 })` in `backend/server.ts` `/health` **or** `members-portal/src/app/api/health/route.ts` — not all three at once.
3. Merge to `main` (or push to `main` if that is your process). Watch the corresponding deploy job:
   - Health step fails after retries.
   - Auto-revert step uploads the previous tag’s tree.
   - Job still ends **failed** (email if notifications are on).
4. Manually hit that Space’s health URL until the previous behavior returns.
5. Immediately ship a fix that restores the health route, get a green deploy, and confirm tags advanced to the fixed SHA.

Do **not** combine a deliberate break with a destructive migration.

## Production now: email branding only

Sites and API stay on Hugging Face URLs. Outbound mail uses your verified Resend domain.

**Local testing uses Resend too** when `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set in `backend/.env` — send a ticket from localhost to confirm `noreply@iclubmedasu.com` works before or after updating the HF Space.

### Resend + Cloudflare (email DNS only)

1. In Resend → Domains → `iclubmedasu.com`, confirm SPF, DKIM, and DMARC (if shown) are **Verified**.
2. Add **exactly** the DNS records Resend shows in Cloudflare (no HF website CNAMEs needed for this step).
3. You do **not** need a `noreply` subdomain — `noreply@iclubmedasu.com` is just the local-part on the verified root domain.

### Backend HF Space (Variables / Secrets)

| Variable | Value |
|----------|--------|
| `RESEND_FROM_EMAIL` | `noreply@iclubmedasu.com` |
| `RESEND_REPLY_TO` | A mailbox that **receives** mail (e.g. club Gmail) |
| `RESEND_API_KEY` | Keep existing |
| `FRONTEND_URL` | `https://iclubmedasu-members-portal.hf.space` |
| `FRONTEND_ORIGINS` | `https://iclubmedasu-members-portal.hf.space,https://iclubmedasu-public-website.hf.space` |
| `PUBLIC_WEBSITE_URL` | `https://iclubmedasu-public-website.hf.space` |
| `API_PUBLIC_URL` | `https://iclubmedasu-backend.hf.space/api` |

Restart the backend Space. Members portal browser calls use same-origin `/backend-api` (BFF) when `NEXT_PUBLIC_API_URL` points at a different host; set portal Space runtime `BACKEND_API_URL=https://iclubmedasu-backend.hf.space`. Public website keeps direct `NEXT_PUBLIC_API_URL=https://iclubmedasu-backend.hf.space/api`.

### Smoke test

1. Local or HF: send a test ticket → From = `noreply@iclubmedasu.com`, Reply-To = your inbox.
2. Ticket links open on `*.hf.space` public/portal URLs.
3. Login / CORS still work on HF hosts.

**GitHub:** nothing new for email branding (custom domains are not configured in GitHub).

## Deferred: custom domain overlay (HF paid custom domains)

Requires Hugging Face custom domains (paid). Skip until you subscribe. When ready:

| Hostname | HF Space |
|----------|----------|
| `iclubmedasu.com` (+ optional `www`) | `iclubmedasu/public-website` |
| `members-portal.iclubmedasu.com` | `iclubmedasu/members-portal` |
| `api.iclubmedasu.com` (optional) | `iclubmedasu/backend` |

Then attach domains in each Space → Custom domains, create the exact Cloudflare records HF shows, and add those origins to `FRONTEND_ORIGINS` **in addition to** the HF fronts (never remove HF as fallback). Do **not** point `PUBLIC_WEBSITE_URL` / `FRONTEND_URL` at custom hosts until those domains are live, or email links will break.

**Common pitfalls:** domain verified in Resend but From still `onboarding@resend.dev`; expecting mail at `noreply@…` (use `RESEND_REPLY_TO`); setting branded site URLs before custom domains work.
## Environment Variables

Here's a clear breakdown of where each variable belongs:

### Hugging Face Space Settings (Backend)
Set these in your backend Hugging Face Space → Settings → Variables and secrets. These are used by your backend at runtime.

| Variable                  | Value/Description                                 |
|---------------------------|---------------------------------------------------|
| DATABASE_URL              | Your Supabase connection string                   |
| JWT_SECRET                | Your secret key for signing tokens                |
| JWT_EXPIRES_IN            | e.g. 7d                                          |
| PORT                      | 7860 (HF requires this port)                      |
| NODE_ENV                  | production                                       |
| DEVELOPER_EMAIL           | Optional; both email+password required to enable dev backdoor |
| DEVELOPER_PASSWORD        | Optional; leave unset in production if unused                 |
| ALLOW_DEVELOPER_BACKDOOR  | Must be `true` to enable the backdoor when `NODE_ENV=production` (default: disabled) |
| GITHUB_STORAGE_OWNER      | e.g. iclubmedasu                                 |
| GITHUB_STORAGE_REPO       | e.g. file-storage                                |
| GITHUB_STORAGE_TOKEN      | Your GitHub PAT for file storage                 |
| GITHUB_USER_DATA_OWNER    | e.g. iclubmedasu                                 |
| GITHUB_USER_DATA_REPO     | e.g. user-data                                   |
| GITHUB_USER_DATA_TOKEN    | Your GitHub PAT for user data                    |
| FRONTEND_URL              | `https://iclubmedasu-members-portal.hf.space` (password-reset / email links). Local: `http://localhost:3001` |
| FRONTEND_ORIGINS          | Comma-separated HF fronts (and localhost for local). Example: `https://iclubmedasu-members-portal.hf.space,https://iclubmedasu-public-website.hf.space`. List every origin explicitly — arbitrary `*.hf.space` is not allowed |
| API_PUBLIC_URL            | `https://iclubmedasu-backend.hf.space/api`. Local: `http://localhost:3000/api` |
| RESEND_API_KEY            | Resend API key for ticket / reminder / certificate emails |
| RESEND_FROM_EMAIL         | `noreply@iclubmedasu.com` after domain Verified in Resend (works for local testing too). Fallback: `onboarding@resend.dev` |
| RESEND_REPLY_TO           | Address that actually receives mail (e.g. Gmail) |
| PUBLIC_WEBSITE_URL        | `https://iclubmedasu-public-website.hf.space`. Local: `http://localhost:3002` |

### Hugging Face Space Settings (Members Portal)
Set these in the members portal Hugging Face Space → Settings → **Variables** (not Secrets). Rebuild after changing any `NEXT_PUBLIC_*` value.

| Variable                        | Value |
|---------------------------------|-------|
| BACKEND_API_URL                 | **Runtime.** Backend origin for the BFF proxy: `https://iclubmedasu-backend.hf.space` (no `/api`). Default if unset. |
| NEXT_PUBLIC_API_URL             | Build-time. `https://iclubmedasu-backend.hf.space/api` (browser remaps to same-origin `/backend-api` on HF) or set `/backend-api` explicitly |
| NEXT_PUBLIC_BACKEND_ORIGIN      | Optional build-time WS host: `https://iclubmedasu-backend.hf.space` |
| NEXT_PUBLIC_PUBLIC_WEBSITE_URL  | Optional: `https://iclubmedasu-public-website.hf.space` |

Credentialed login goes through **same-origin** `/backend-api/*` so it is not blocked by Hugging Face Spaces OPTIONS CORS (preflight without `Access-Control-Allow-Credentials`).

### Hugging Face Space Settings (Public Website)
Set these in the public website Hugging Face Space → Settings → **Variables** (not Secrets — build-time vars must be Variables). Rebuild after any change.

| Variable             | Value |
|----------------------|-------|
| NEXT_PUBLIC_API_URL  | `https://iclubmedasu-backend.hf.space/api` |

That's the only build-time variable each frontend needs. HF passes Variables as Docker build args, which Next.js inlines at build time.

### GitHub Actions Secrets (CI/CD)
Set these in GitHub → repo Settings → Secrets and variables → Actions. These are used by your CI/CD workflow during deployment.

| Variable           | Used for                                             |
|--------------------|------------------------------------------------------|
| DATABASE_URL       | Running Prisma migrations in the migrate job         |
| HF_TOKEN           | Authenticating the push to Hugging Face               |
| HF_SPACE           | Backend HF space path e.g. iclubmedasu/backend       |
| HF_FRONTEND_SPACE  | Members portal HF space path e.g. iclubmedasu/members-portal |
| HF_PUBLIC_SPACE    | Public website HF space path e.g. iclubmedasu/public-website |

### Variables you can ignore

| Variable              | Why                                                      |
|-----------------------|----------------------------------------------------------|
| SUPABASE_PROJECT_NAME | Not used in code, just for your own reference            |
| SUPABASE_PROJECT_ID   | Same — informational only                                |
| SUPABASE_DB_PASSWORD  | Already baked into DATABASE_URL, not needed separately   |

### Legacy cleanup (Netlify)

The members portal previously deployed to Netlify. If you have not already:

1. Disconnect or delete the old Netlify site for the members portal.
2. Remove any `NETLIFY_*` secrets from GitHub Actions if they are still present.

#### Quick rule of thumb to remember

> **Does the backend need it to run?** → Backend Hugging Face Space settings  
> **Does the frontend need it to build?** → Frontend Hugging Face Space Variables  
> **Does the GitHub workflow need it to deploy?** → GitHub Actions secrets  
> **Is it the same variable needed in two places?** → Set it in both (like DATABASE_URL lives in both HF and GitHub)

## Backend Deployment (Hugging Face Spaces)

1. The backend is deployed as a Docker container to Hugging Face Spaces: [Space link](https://huggingface.co/spaces/iclubmedasu/backend)
2. Environment variables are set in the Hugging Face Space settings.
3. On startup, the container runs `prisma migrate deploy` before starting the API process.
4. API endpoints:
	- [API](https://iclubmedasu-backend.hf.space/api)
	- [Health check](https://iclubmedasu-backend.hf.space/health)
5. **Keep-alive Monitoring:**
	- The Hugging Face Space is kept alive using [UptimeRobot](https://dashboard.uptimerobot.com/monitors/802817894), which regularly pings the health endpoint to prevent the space from sleeping.
6. **Post-deploy health + auto-revert:** see [Deploy safety net](#deploy-safety-net-health-check--auto-revert). CI also fails the job if `/health` never returns 200 after the rebuild wait.

## Database (Supabase)

1. Create a new Supabase project and PostgreSQL database.
2. Set the `DATABASE_URL` in Hugging Face and local `.env` files.
3. Run migrations using `prisma migrate deploy`.
4. The deploy workflow also runs `seed:support-content` after migrations so the support page CMS rows exist in production (migrations create tables only; default notice blocks are seeded separately).
5. The Prisma migration set enables Row-Level Security on every app table so Supabase's public REST API cannot read or modify data directly.
6. If you need to edit data manually as the project owner, use the Supabase SQL editor or dashboard with a privileged account rather than the public anon API.
7. **Migrations are not auto-reverted.** Prefer additive schema changes. See [Deploy safety net](#deploy-safety-net-health-check--auto-revert).

## Frontend Deployment (Members Portal — Hugging Face Spaces)

1. The members portal (Next.js app) is deployed as a Docker Space: [Live site](https://iclubmedasu-members-portal.hf.space)
2. Set `NEXT_PUBLIC_API_URL` = `https://iclubmedasu-backend.hf.space/api` in the frontend Space → Settings → Variables
3. The Dockerfile lives at [`members-portal/Dockerfile`](../members-portal/Dockerfile). CI copies it to the repo root before uploading to the Space.
4. Next.js runs in `standalone` output mode on port 7860 (required by HF Spaces). The runner stage uses `--chown=nextjs:nodejs` so ISR cache writes do not hit `EACCES` at runtime.
5. Space config is in [`members-portal/README.hf.md`](../members-portal/README.hf.md) (copied to `README.md` during deploy).

### Post-deploy health and static asset check (Members Portal)

CI health endpoint: `https://iclubmedasu-members-portal.hf.space/api/health` (must return HTTP 200 after deploy).

Also verify these return HTTP 200:

- `https://iclubmedasu-members-portal.hf.space/favicon.ico`
- `https://iclubmedasu-members-portal.hf.space/icons/icon-192x192.png`

If users still see favicon errors after deploy, unregister the old service worker (DevTools → Application → Service Workers) and hard-refresh.

## Frontend Deployment (Public Website — Hugging Face Spaces)

1. The public website (Next.js app) is deployed as a Docker Space: [Live site](https://iclubmedasu-public-website.hf.space)
2. Set `NEXT_PUBLIC_API_URL` = `https://iclubmedasu-backend.hf.space/api` in the Space → Settings → Variables
3. The Dockerfile lives at [`public-website/Dockerfile`](../public-website/Dockerfile). CI copies it to the repo root before uploading to the Space.
4. Next.js runs in `standalone` output mode on port 7860 (required by HF Spaces). Production builds use `next build --webpack` (Turbopack rejects some PNG assets on HF).
5. Space config is in [`public-website/README.hf.md`](../public-website/README.hf.md) (copied to `README.md` during deploy).
6. Set backend `PUBLIC_WEBSITE_URL` = `https://iclubmedasu-public-website.hf.space` in the backend HF Space so ticket confirmation emails link to the live site.
7. Binary assets are plain files in this monorepo (GitHub). Deploy installs `huggingface_hub[hf_xet]` and does **not** upload monorepo `.gitattributes` claiming `filter=xet` (that caused HF to reject raw binaries). CI runs [`materialize-public-images.mjs`](../public-website/scripts/materialize-public-images.mjs) **before upload** (using `GITHUB_TOKEN` + retries) so real PNG bytes are in the Space when GitHub LFS/Xet pointers appear. The Dockerfile runs the same script as a safety net during the Space build.

### Post-deploy health and static asset check (Public Website)

CI health endpoint: `https://iclubmedasu-public-website.hf.space/api/health` (must return HTTP 200 after deploy).

Also verify these return HTTP 200 with real PNG bytes (Content-Length well over 1 KB, not ~131-byte pointer stubs):

- `https://iclubmedasu-public-website.hf.space/favicon.ico`
- `https://iclubmedasu-public-website.hf.space/images/iclub_full_colored_transparent_outlined_logo.png`
- `https://iclubmedasu-public-website.hf.space/images/ihub_full_colored_transparent_logo_outlined.png`

## Troubleshooting

### Public website Docker build fails with `HTTP 429` on `raw.githubusercontent.com`

HF may receive Xet pointer stubs instead of real PNG bytes. The materialize script fetches real images from GitHub; **429** means GitHub rate-limited the request.

1. **Redeploy via GitHub Actions** — CI now materializes images before upload (authenticated `GITHUB_TOKEN`) so the Space should already contain real PNGs.
2. If the Space build still retries fetches, wait a few minutes and **Rebuild** the Space (the script backs off on 429).
3. Confirm post-deploy asset URLs return real PNG sizes (see [Post-deploy static asset check](#post-deploy-static-asset-check-public-website)).

### Public website shows empty pages or old `503` errors in logs

The public website loads data in the **browser** (same pattern as the members portal), not during Next.js server-side render. Server-to-server calls between Hugging Face Spaces often return **503** even when the same API URL works from a user's browser.

1. Open [backend health](https://iclubmedasu-backend.hf.space/health) — expect HTTP 200 and `"status":"ok"`.
2. Open [public events API](https://iclubmedasu-backend.hf.space/api/public/events?limit=5&upcoming=false) in your browser — expect a JSON array.
3. If health returns 503: open the [backend Space](https://huggingface.co/spaces/iclubmedasu/backend) → **Logs** — check for missing `DATABASE_URL`, Prisma errors, or crash on startup.
4. Wake a sleeping Space by visiting `/health`; confirm [UptimeRobot](https://dashboard.uptimerobot.com/monitors/802817894) pings `/health` regularly.
5. On the **public-website** Space → Settings → **Variables**, set `NEXT_PUBLIC_API_URL` to exactly `https://iclubmedasu-backend.hf.space/api` with **no leading or trailing spaces** (must be **Variables**, not Secrets — it is baked in at Docker build time). **Rebuild** the Space after changing it.

If `NEXT_PUBLIC_API_URL` is missing at build time, browser fetches fall back to `localhost:3000` on the client and pages stay empty on the live site.

### Copy link from members portal shows `localhost:3002`

The copy-link button uses the backend’s existing `PUBLIC_WEBSITE_URL` (via `GET /api/public/site-config`), or derives `iclubmedasu-public-website.hf.space` from the members-portal HF hostname. **No separate members-portal variable is required** if backend `PUBLIC_WEBSITE_URL` is set.

Optional override for local dev: `NEXT_PUBLIC_PUBLIC_WEBSITE_URL` in members-portal `.env.local`.

### Event URL returns 404 on the live public site

If the event is published and the [public API](https://iclubmedasu-backend.hf.space/api/public/events/1) returns data in your browser, but the page shows “Event not found”, check that `NEXT_PUBLIC_API_URL` is set correctly on the public-website Space (no spaces) and rebuild. Open the browser network tab — `/api/public/events/1` should return 200 from the user's browser.

## Local Docker Testing

You can still use Docker Compose for local development:

```bash
# Start database and API
docker-compose up db api

# Build and run portal
docker-compose up portal
```

## Production Docker Build (optional)

```bash
# Build backend image
docker build -f backend/Dockerfile -t iclub-api .

# Build portal image (pass API URL at build time)
docker build -f members-portal/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:3000/api \
  -t iclub-portal .

# Build public website image (pass API URL at build time)
docker build -f public-website/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:3000/api \
  -t iclub-public .
```

## Post-Deployment Checklist

- [ ] Database migrations ran successfully
- [ ] Environment variables set correctly
- [ ] API health endpoint returns 200 ([check here](https://iclubmedasu-backend.hf.space/health))
- [ ] Members portal health returns 200 (`https://iclubmedasu-members-portal.hf.space/api/health`)
- [ ] Public website health returns 200 (`https://iclubmedasu-public-website.hf.space/api/health`)
- [ ] Members portal loads ([check here](https://iclubmedasu-members-portal.hf.space))
- [ ] Public website loads ([check here](https://iclubmedasu-public-website.hf.space))
- [ ] Deploy Actions jobs green (or failed only after a deliberate/auto-revert — check HF Space is healthy either way)
- [ ] Known-good tags present after first green deploys: `deployed-backend`, `deployed-frontend`, `deployed-public`
- [ ] Backend `PUBLIC_WEBSITE_URL` set to `https://iclubmedasu-public-website.hf.space` on the backend HF Space
- [ ] Public website `NEXT_PUBLIC_API_URL` = `https://iclubmedasu-backend.hf.space/api` in HF Space **Variables** (rebuild after change)
- [ ] Public API smoke test: `https://iclubmedasu-backend.hf.space/api/public/events?limit=5&upcoming=false` returns JSON
- [ ] Login works (cookie set, API calls succeed, no CORS errors)
- [ ] *(Email branding)* Resend domain Verified; backend HF (and/or local `.env`) has `RESEND_FROM_EMAIL=noreply@iclubmedasu.com` and `RESEND_REPLY_TO`; test ticket From/Reply-To
- [ ] *(Deferred)* Custom website domains — see [Deferred: custom domain overlay](#deferred-custom-domain-overlay-hf-paid-custom-domains) when HF paid custom domains are available
