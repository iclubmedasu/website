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
| `NEXT_PUBLIC_API_URL` | Build-time | Backend API base, e.g. `https://iclubmedasu-backend.hf.space/api`. **Default (direct mode):** browser calls this URL with Bearer auth (same idea as the public website). |
| `NEXT_PUBLIC_PORTAL_USE_BFF` | Build-time (optional) | Set to `true` and **rebuild** to restore same-origin `/backend-api` BFF + cookie session. Leave unset/false for temporary direct API mode. |
| `BACKEND_API_URL` | **Runtime** | Backend origin for the BFF proxy, e.g. `https://iclubmedasu-backend.hf.space` (no `/api`). Needed when BFF is enabled; keep set for easy reversal. |
| `BFF_PROXY_SECRET` | **Runtime secret** | Same value as backend Space `BFF_PROXY_SECRET`. Used when BFF is on. Keep set on both Spaces for reversal. |
| `NEXT_PUBLIC_BACKEND_ORIGIN` | Build-time (optional) | Backend origin used for WebSocket (`wss://…/api/notifications/ws`). Defaults from `NEXT_PUBLIC_API_URL` host or `https://iclubmedasu-backend.hf.space`. |
| `NEXT_PUBLIC_PUBLIC_WEBSITE_URL` | Build-time (optional) | Public website base URL for copy-link. If unset, derived from HF hostname or backend `PUBLIC_WEBSITE_URL` via `/api/public/site-config`. |

## TEMPORARY — HF direct API

**Default = direct browser → backend.** Portal UI still serves from this Space; API traffic does **not** hop Space→Space via `/backend-api` (avoids HF 502/429 on the BFF). Auth uses `Authorization: Bearer` + `localStorage` (temporary tradeoff; XSS can read the token). Cross-origin fetches use `credentials: "omit"`.

This does **not** wake a sleeping portal Space — keep `/api/health` keep-alive for that.

### Reversal (restore BFF)

1. Set Space Variable `NEXT_PUBLIC_PORTAL_USE_BFF=true`.
2. Confirm `NEXT_PUBLIC_API_URL=https://iclubmedasu-backend.hf.space/api` (or `/backend-api`).
3. Confirm runtime `BACKEND_API_URL` and matching `BFF_PROXY_SECRET` on portal + backend.
4. **Rebuild** the portal Space (build-time vars are baked into the Next bundle).

BFF route + `bffProxy` code remain in the repo; unused while the flag is off.

### Why `/backend-api` exists (when BFF is on)

Hugging Face Spaces edge often answers CORS **preflight** without `Access-Control-Allow-Credentials: true`. Credentialed `fetch` from `members-portal.hf.space` → `backend.hf.space` then fails. The portal proxies `/backend-api/*` server-side to `{BACKEND_API_URL}/api/*` so the browser stays same-origin. The BFF also forwards the browser IP (with `BFF_PROXY_SECRET`) and retries once on HF HTML/502/503 blips without retrying Express JSON 429.
