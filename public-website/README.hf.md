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
| `NEXT_PUBLIC_API_URL` | Backend API base URL, e.g. `https://iclubmedasu-backend.hf.space/api` |
