# Required GitHub Secrets
 
Go to your GitHub repository → Settings → Secrets and variables → Actions
Add the following secrets:
 
## Hugging Face (Backend Deployment)
- HF_TOKEN — Your Hugging Face User Access Token (write access)
- HF_SPACE — Backend space path e.g. `iclubmedasu/backend`

## Hugging Face (Frontend Deployment)
- HF_TOKEN — Same token as above (reused)
- HF_FRONTEND_SPACE — Frontend space path e.g. `iclubmedasu/members-portal`

## Database
- DATABASE_URL — Supabase connection string (used by the migrate job)

## Notes
- GITHUB_TOKEN is automatically provided by GitHub Actions — you do not need to add it
- Only set up deployment secrets when you are ready to deploy
- The CI pipeline (lint, typecheck, build) works without any secrets
- Set `NEXT_PUBLIC_API_URL` in the **frontend HF Space Variables** (not GitHub secrets) — it is inlined at Docker build time
