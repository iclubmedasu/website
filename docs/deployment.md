# Deployment Guide

## Overview

This project is deployed using GitHub Actions, with the following services:

| Service           | Purpose                | Provider/URL |
|-------------------|------------------------|--------------|
| Backend API       | Node.js API            | [Hugging Face Spaces](https://huggingface.co/spaces/iclubmedasu/backend) ([API test](https://your-hf-space-url.hf.space/api), [Health check](https://iclubmedasu-backend.hf.space/health)) |
| Database          | PostgreSQL             | [Supabase](https://supabase.com/) |
| Members Portal    | Next.js Node.js app    | [Netlify](https://69d96de0a0d4b29ccf1ca911--luxury-jelly-b24265.netlify.app) |

## Deployment Flow

1. **GitHub Actions**: CI/CD pipeline builds and deploys both backend and frontend on push to main.
2. **Backend**: Deployed as a Hugging Face Space (Docker container). API and health endpoints:
	- [API test](https://your-hf-space-url.hf.space/api)
	- [Health check](https://iclubmedasu-backend.hf.space/health)
3. **Database**: Managed by Supabase. Connection string is set via environment variables.
4. **Frontend (Members Portal)**: Deployed to Netlify as a Next.js app:
	- [Live site](https://69d96de0a0d4b29ccf1ca911--luxury-jelly-b24265.netlify.app)


## Environment Variables

Here's a clear breakdown of where each variable belongs:

### Hugging Face Space Settings (Backend)
Set these in your Hugging Face Space → Settings → Variables and secrets. These are used by your backend at runtime.

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
| FRONTEND_URL              | https://your-site.netlify.app                    |
| FRONTEND_ORIGINS          | Same as above, or comma-separated list if needed |

### Netlify Environment Variables (Frontend)
Set these in Netlify → Site configuration → Environment variables. These are used by your frontend at build time.

| Variable             | Value                                      |
|----------------------|---------------------------------------------|
| NEXT_PUBLIC_API_URL  | https://your-hf-space-url.hf.space/api    |

That's genuinely the only one the frontend needs.

### GitHub Actions Secrets (CI/CD)
Set these in GitHub → repo Settings → Secrets and variables → Actions. These are used by your CI/CD workflow during deployment.

| Variable      | Used for                                             |
|--------------|-----------------------------------------------------|
| DATABASE_URL | Running Prisma migrations in the migrate job        |
| HF_TOKEN     | Authenticating the push to Hugging Face             |
| HF_SPACE     | The HF space path e.g. iclubmedasu/backend          |

### Variables you can ignore or delete

| Variable            | Why                                                        |
|---------------------|------------------------------------------------------------|
| NETLIFY_AUTH_TOKEN  | No longer needed — you deleted the deploy-frontend job      |
| NETLIFY_SITE_ID     | Same reason                                                |
| HF_SPACE_URL        | Was only used in the deploy-frontend job which is now gone |
| SUPABASE_PROJECT_NAME | Not used in code, just for your own reference            |
| SUPABASE_PROJECT_ID   | Same — informational only                                |
| SUPABASE_DB_PASSWORD  | Already baked into DATABASE_URL, not needed separately   |

#### Quick rule of thumb to remember

> **Does the backend need it to run?** → Hugging Face Space settings  
> **Does the frontend need it to build?** → Netlify environment variables  
> **Does the GitHub workflow need it to deploy?** → GitHub Actions secrets  
> **Is it the same variable needed in two places?** → Set it in both (like DATABASE_URL lives in both HF and GitHub)

## Backend Deployment (Hugging Face Spaces)

1. The backend is deployed as a Docker container to Hugging Face Spaces: [Space link](https://huggingface.co/spaces/iclubmedasu/backend)
2. Environment variables are set in the Hugging Face Space settings.
3. On startup, the container runs `prisma migrate deploy` before starting the API process.
4. API endpoints:
	- [API test](https://your-hf-space-url.hf.space/api)
	- [Health check](https://iclubmedasu-backend.hf.space/health)
5. **Keep-alive Monitoring:**
	- The Hugging Face Space is kept alive using [UptimeRobot](https://dashboard.uptimerobot.com/monitors/802817894), which regularly pings the health endpoint to prevent the space from sleeping.

## Database (Supabase)

1. Create a new Supabase project and PostgreSQL database.
2. Set the `DATABASE_URL` in Hugging Face and local `.env` files.
3. Run migrations using `prisma migrate deploy`.

## Frontend Deployment (Netlify)

1. The members portal (Next.js app) is deployed to Netlify: [Live site](https://iclubmedasu-members-portal.netlify.app/)
2. Environment variables are set in the Netlify dashboard. Set NEXT_PUBLIC_API_URL = https://your-hf-space-url.hf.space/api
3. Build command: `pnpm --filter members-portal build`
4. Publish directory: `members-portal/.next`
5. Runtime: Node.js (Next.js server, not static export)

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

# Build portal image
docker build -f members-portal/Dockerfile -t iclub-portal .
```

## Post-Deployment Checklist

- [ ] Database migrations ran successfully
- [ ] Environment variables set correctly
- [ ] API health endpoint returns 200 ([check here](https://iclubmedasu-backend.hf.space/health))
- [ ] Frontend loads ([check here](https://69d96de0a0d4b29ccf1ca911--luxury-jelly-b24265.netlify.app))
