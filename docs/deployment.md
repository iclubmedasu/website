# Deployment Guide

## Overview

This project is deployed using GitHub Actions, with the following services:

| Service           | Purpose                | Provider/URL |
|-------------------|------------------------|--------------|
| Backend API       | Node.js API            | [Hugging Face Spaces](https://huggingface.co/spaces/iclubmedasu/backend) ([API test](https://iclubmedasu-backend.hf.space/api), [Health check](https://iclubmedasu-backend.hf.space/health)) |
| Database          | PostgreSQL             | [Supabase](https://supabase.com/) |
| Members Portal    | Next.js Node.js app    | [Netlify](https://69d96de0a0d4b29ccf1ca911--luxury-jelly-b24265.netlify.app) |

## Deployment Flow

1. **GitHub Actions**: CI/CD pipeline builds and deploys both backend and frontend on push to main.
2. **Backend**: Deployed as a Hugging Face Space (Docker container). API and health endpoints:
	- [API test](https://iclubmedasu-backend.hf.space/api)
	- [Health check](https://iclubmedasu-backend.hf.space/health)
3. **Database**: Managed by Supabase. Connection string is set via environment variables.
4. **Frontend (Members Portal)**: Deployed to Netlify as a Next.js app:
	- [Live site](https://69d96de0a0d4b29ccf1ca911--luxury-jelly-b24265.netlify.app)

## Environment Variables

See `.env.example` for all required variables and descriptions. Set these in GitHub repository secrets and in Hugging Face/Supabase/Netlify dashboards as needed.

Key variables:
- `DATABASE_URL` (Supabase connection string, use `sslmode=require` and `schema=public`)
- `JWT_SECRET`
- `NEXT_PUBLIC_API_URL`

## Backend Deployment (Hugging Face Spaces)

1. The backend is deployed as a Docker container to Hugging Face Spaces: [Space link](https://huggingface.co/spaces/iclubmedasu/backend)
2. Environment variables are set in the Hugging Face Space settings.
3. On startup, the container runs `prisma migrate deploy` before starting the API process.
4. API endpoints:
	- [API test](https://iclubmedasu-backend.hf.space/api)
	- [Health check](https://iclubmedasu-backend.hf.space/health)
5. **Keep-alive Monitoring:**
	- The Hugging Face Space is kept alive using [UptimeRobot](https://dashboard.uptimerobot.com/monitors/802817894), which regularly pings the health endpoint to prevent the space from sleeping.

## Database (Supabase)

1. Create a new Supabase project and PostgreSQL database.
2. Set the `DATABASE_URL` in Hugging Face and local `.env` files.
3. Run migrations using `prisma migrate deploy`.

## Frontend Deployment (Netlify)

1. The members portal (Next.js app) is deployed to Netlify: [Live site](https://69d96de0a0d4b29ccf1ca911--luxury-jelly-b24265.netlify.app)
2. Environment variables are set in the Netlify dashboard. Set NEXT_PUBLIC_API_URL
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
