---
title: iClub Backend API
emoji: 🛠️
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# iClub Backend API

Express API for the iClub members portal and public website. Deployed as a Docker Space on Hugging Face.

## Configuration

Set secrets and variables in **Space Settings → Variables and secrets** (not in this file). See monorepo [docs/deployment.md](https://github.com/iclubmedasu/website/blob/main/docs/deployment.md).

Common keys:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Supabase Postgres connection string |
| `JWT_SECRET` | JWT signing secret (production required) |
| `FRONTEND_URL` | Members portal origin (password-reset links) |
| `FRONTEND_ORIGINS` | Comma-separated CORS browser origins |
| `PUBLIC_WEBSITE_URL` | Public site origin |
| `PORT` | Must be `7860` on Hugging Face Spaces |

Health check: `GET /health`
