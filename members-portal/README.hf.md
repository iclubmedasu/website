---
title: iClub Members Portal
emoji: 🏥
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

# iClub Members Portal

Next.js frontend for the iClub members portal. Deployed as a Docker Space on Hugging Face.

## Environment Variables

Set these in Space Settings → Variables (not Secrets — build-time vars must be Variables):

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL, e.g. `https://iclubmedasu-backend.hf.space/api` |
| `NEXT_PUBLIC_PUBLIC_WEBSITE_URL` | Optional. Public website base URL for copy-link. If unset, derived from HF hostname or backend `PUBLIC_WEBSITE_URL` via `/api/public/site-config`. |
