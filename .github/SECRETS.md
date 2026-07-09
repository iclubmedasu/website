# Required GitHub Secrets
 
Go to your GitHub repository → Settings → Secrets and variables → Actions
Add the following secrets:
 
## Hugging Face (Backend Deployment)
- HF_TOKEN — Your Hugging Face User Access Token (write access)
- HF_SPACE — Backend space path e.g. `iclubmedasu/backend`

## Hugging Face (Members Portal Deployment)
- HF_TOKEN — Same token as above (reused)
- HF_FRONTEND_SPACE — Members portal space path e.g. `iclubmedasu/members-portal`

## Hugging Face (Public Website Deployment)
- HF_TOKEN — Same token as above (reused)
- HF_PUBLIC_SPACE — Public website space path e.g. `iclubmedasu/public-website`

## Database
- DATABASE_URL — Supabase connection string (used by the migrate job)

## Notes
- GITHUB_TOKEN is automatically provided by GitHub Actions — you do not need to add it
- Only set up deployment secrets when you are ready to deploy
- The CI pipeline (lint, typecheck, build) works without any secrets
- Docker Spaces must exist on HF before first deploy (create manually in HF UI). CI uploads only — it does not call `create_repo` (avoids HF 402 without PRO).
- Set `NEXT_PUBLIC_API_URL` in each **frontend HF Space Variables** (members portal and public website — not GitHub secrets) — it is inlined at Docker build time
