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

## Security automation (Phase 1)

These run in GitHub Actions and do **not** require paid GitHub Advanced Security. Existing deploy workflows are unchanged.

### Dependabot (dependency updates)
- Config: [`.github/dependabot.yml`](dependabot.yml) — weekly PRs for npm/pnpm (workspace root) and GitHub Actions.
- Enable: once the file is on the default branch, Dependabot starts automatically. Optionally confirm under **Settings → Code security → Dependabot**.
- Alerts: enable **Dependabot alerts** and **Dependabot security updates** in the same settings page if not already on.

### Semgrep CE (SAST)
- Workflow: [`.github/workflows/semgrep.yml`](workflows/semgrep.yml) — OSS rules (`semgrep scan --config auto`) on PRs and pushes to `main`/`develop`.
- **Why not CodeQL?** CodeQL code scanning on **private** repos needs GitHub Code Security / Advanced Security (paid). Semgrep Community Edition does not.
- Optional later: if the repo is public, or you buy Code Security, add GitHub’s CodeQL workflow and keep or drop Semgrep.
- Optional: add `SEMGREP_APP_TOKEN` only if you adopt Semgrep AppSec Platform (not required for CE).

### Secret scanning
1. **GitHub secret scanning (preferred platform feature)**  
   - **Public repos:** usually on by default.  
   - **Private repos:** requires GitHub Secret Protection / Advanced Security (paid).  
   - Path: **Settings → Code security → Secret scanning** → Enable (when available).
2. **Gitleaks in CI (works on free/private)**  
   - Workflow: [`.github/workflows/gitleaks.yml`](workflows/gitleaks.yml) — scans the checkout on PRs/pushes with no org license.  
   - Uses the Gitleaks Docker image directly (not `gitleaks-action`, which requires a license for GitHub Organizations).

### Existing
- `pnpm audit` remains in [`.github/workflows/ci.yml`](workflows/ci.yml) (`Security Audit` job).
