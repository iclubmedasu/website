# Required GitHub Secrets
 
Go to your GitHub repository → Settings → Secrets and variables → Actions
Add the following secrets:
 
## Railway (Backend Deployment)
- RAILWAY_TOKEN — Your Railway API token (from Railway dashboard → Account Settings)
- RAILWAY_BACKEND_SERVICE — Your Railway service name or ID
 
## Netlify (Frontend Deployment)
- NETLIFY_AUTH_TOKEN — Your Netlify personal access token
- NETLIFY_SITE_ID — Site ID for the members portal (from Netlify site settings)
- NETLIFY_PUBLIC_SITE_ID — Site ID for the public website
 
## Notes
- GITHUB_TOKEN is automatically provided by GitHub Actions — you do not need to add it
- Only set up deployment secrets when you are ready to deploy
- The CI pipeline (lint, typecheck, build) works without any secrets
