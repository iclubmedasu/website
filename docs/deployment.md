# Deployment Guide

## Overview

This project is deployed using GitHub Actions, with the following services:

| Service           | Purpose                | Provider/URL |
|-------------------|------------------------|--------------|
| Backend API       | Node.js API            | [Hugging Face Spaces](https://huggingface.co/spaces/iclubmedasu/backend) ([API](https://iclubmedasu-backend.hf.space/api), [Health](https://iclubmedasu-backend.hf.space/health)) |
| Database          | PostgreSQL             | [Supabase](https://supabase.com/) |
| Members Portal    | Next.js Node.js app    | [Hugging Face Spaces](https://huggingface.co/spaces/iclubmedasu/members-portal) ([Live site](https://iclubmedasu-members-portal.hf.space)) |
| Public Website    | Next.js Node.js app    | [Hugging Face Spaces](https://huggingface.co/spaces/iclubmedasu/public-website) ([Live site](https://iclubmedasu-public-website.hf.space)) |

## Deployment Flow

1. **GitHub Actions**: CI/CD pipeline builds and deploys the backend, members portal, and public website on push to main.
2. **Backend**: Deployed as a Hugging Face Space (Docker container). API and health endpoints:
	- [API](https://iclubmedasu-backend.hf.space/api)
	- [Health check](https://iclubmedasu-backend.hf.space/health)
3. **Database**: Managed by Supabase. Connection string is set via environment variables.
4. **Frontend (Members Portal)**: Deployed as a Hugging Face Space (Docker container):
	- [Live site](https://iclubmedasu-members-portal.hf.space)
5. **Public Website**: Deployed as a Hugging Face Space (Docker container):
	- [Live site](https://iclubmedasu-public-website.hf.space)


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
| DEVELOPER_EMAIL           | Your dev backdoor email                          |
| DEVELOPER_PASSWORD        | Your dev backdoor password                       |
| GITHUB_STORAGE_OWNER      | e.g. iclubmedasu                                 |
| GITHUB_STORAGE_REPO       | e.g. file-storage                                |
| GITHUB_STORAGE_TOKEN      | Your GitHub PAT for file storage                 |
| GITHUB_USER_DATA_OWNER    | e.g. iclubmedasu                                 |
| GITHUB_USER_DATA_REPO     | e.g. user-data                                   |
| GITHUB_USER_DATA_TOKEN    | Your GitHub PAT for user data                    |
| FRONTEND_URL              | https://iclubmedasu-members-portal.hf.space      |
| FRONTEND_ORIGINS          | Comma-separated origins, e.g. `https://iclubmedasu-members-portal.hf.space,https://iclubmedasu-public-website.hf.space` (`*.hf.space` is also allowed at runtime) |
| RESEND_API_KEY            | Resend API key for ticket emails                 |
| RESEND_FROM_EMAIL         | Verified sender in Resend (not @gmail.com); use your domain e.g. tickets@yourdomain.com |
| RESEND_REPLY_TO           | Optional reply-to address e.g. asu.medicine.iclub@gmail.com |
| PUBLIC_WEBSITE_URL        | `https://iclubmedasu-public-website.hf.space` in production (ticket email confirmation links); `http://localhost:3002` locally |

### Hugging Face Space Settings (Members Portal)
Set these in the members portal Hugging Face Space → Settings → **Variables** (not Secrets — build-time vars must be Variables).

| Variable             | Value                                              |
|----------------------|----------------------------------------------------|
| NEXT_PUBLIC_API_URL  | https://iclubmedasu-backend.hf.space/api           |

### Hugging Face Space Settings (Public Website)
Set these in the public website Hugging Face Space → Settings → **Variables** (not Secrets — build-time vars must be Variables).

| Variable             | Value                                              |
|----------------------|----------------------------------------------------|
| NEXT_PUBLIC_API_URL  | https://iclubmedasu-backend.hf.space/api           |

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

## Database (Supabase)

1. Create a new Supabase project and PostgreSQL database.
2. Set the `DATABASE_URL` in Hugging Face and local `.env` files.
3. Run migrations using `prisma migrate deploy`.
4. The deploy workflow also runs `seed:support-content` after migrations so the support page CMS rows exist in production (migrations create tables only; default notice blocks are seeded separately).
5. The Prisma migration set enables Row-Level Security on every app table so Supabase's public REST API cannot read or modify data directly.
6. If you need to edit data manually as the project owner, use the Supabase SQL editor or dashboard with a privileged account rather than the public anon API.

## Frontend Deployment (Members Portal — Hugging Face Spaces)

1. The members portal (Next.js app) is deployed as a Docker Space: [Live site](https://iclubmedasu-members-portal.hf.space)
2. Set `NEXT_PUBLIC_API_URL` = `https://iclubmedasu-backend.hf.space/api` in the frontend Space → Settings → Variables
3. The Dockerfile lives at [`members-portal/Dockerfile`](../members-portal/Dockerfile). CI copies it to the repo root before uploading to the Space.
4. Next.js runs in `standalone` output mode on port 7860 (required by HF Spaces). The runner stage uses `--chown=nextjs:nodejs` so ISR cache writes do not hit `EACCES` at runtime.
5. Space config is in [`members-portal/README.hf.md`](../members-portal/README.hf.md) (copied to `README.md` during deploy).

### Post-deploy static asset check (Members Portal)

Verify these return HTTP 200:

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
7. Binary assets (PNG, etc.) are stored via Xet — see root [`.gitattributes`](../.gitattributes) (`filter=xet`). CI uses `huggingface_hub[hf_xet]` when uploading to Spaces.

### Post-deploy static asset check (Public Website)

Verify these return HTTP 200 with real image bytes (not a short Git LFS pointer body):

- `https://iclubmedasu-public-website.hf.space/favicon.ico`
- Footer logos are bundled from `src/assets` at build time; after deploy, open the live site footer on a phone-sized viewport and confirm both iClub and iHub logos render.

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
- [ ] Members portal loads ([check here](https://iclubmedasu-members-portal.hf.space))
- [ ] Public website loads ([check here](https://iclubmedasu-public-website.hf.space))
- [ ] Backend `PUBLIC_WEBSITE_URL` set to `https://iclubmedasu-public-website.hf.space` on the backend HF Space
- [ ] Login works (cookie set, API calls succeed, no CORS errors)
