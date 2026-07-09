---
title: iClub Public Website
emoji: 🌐
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# iClub Public Website

Next.js public-facing website for event registration and ticket confirmation. Deployed as a Docker Space on Hugging Face.

## Environment Variables

Set these in Space Settings → Variables (not Secrets — build-time vars must be Variables):

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | **Required.** Backend API base URL, e.g. `https://iclubmedasu-backend.hf.space/api`. Must be set under **Variables** (not Secrets) so it is passed as a Docker build arg. Rebuild the Space after changing. |

If this variable is missing at build time, server-side page renders will log errors and public pages will show empty content (503 or connection failures to `localhost:3000`).
