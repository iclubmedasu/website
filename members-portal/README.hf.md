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

Set these in Space Settings → Variables (not Secrets). Runtime vars apply without rebuild; `NEXT_PUBLIC_*` are inlined at Docker build time.

| Variable | When | Description |
|----------|------|-------------|
| `BACKEND_API_URL` | **Runtime** (recommended) | Backend origin for the same-origin BFF proxy, e.g. `https://iclubmedasu-backend.hf.space` (no `/api` suffix). Defaults to that URL if unset. |
| `BFF_PROXY_SECRET` | **Runtime secret** | Same value as backend Space `BFF_PROXY_SECRET`. Lets the BFF send trusted client IP headers so Express auth rate limits are per browser, not one shared portal NAT bucket. Set on **both** Spaces after deploy. |
| `NEXT_PUBLIC_API_URL` | Build-time | Often still set to `https://iclubmedasu-backend.hf.space/api`. On HF the browser remaps this to same-origin `/backend-api` so credentialed login avoids Spaces OPTIONS CORS stripping. Or set to `/backend-api` explicitly. |
| `NEXT_PUBLIC_BACKEND_ORIGIN` | Build-time (optional) | Backend origin used for WebSocket (`wss://…/api/notifications/ws`). Defaults from `NEXT_PUBLIC_API_URL` host or `https://iclubmedasu-backend.hf.space`. |
| `NEXT_PUBLIC_PUBLIC_WEBSITE_URL` | Build-time (optional) | Public website base URL for copy-link. If unset, derived from HF hostname or backend `PUBLIC_WEBSITE_URL` via `/api/public/site-config`. |

### Why `/backend-api`?

Hugging Face Spaces edge often answers CORS **preflight** without `Access-Control-Allow-Credentials: true`. Credentialed `fetch` from `members-portal.hf.space` → `backend.hf.space` then fails. The portal proxies `/backend-api/*` server-side to `{BACKEND_API_URL}/api/*` so the browser stays same-origin. The BFF also forwards the browser IP (with `BFF_PROXY_SECRET`) and retries once on HF HTML/502/503 blips without retrying Express JSON 429.
