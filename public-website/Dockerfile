# ============================================
# iClub Public Website - Dockerfile (Next.js)
# Built for Hugging Face Spaces (port 7860)
# ============================================

FROM node:20-alpine AS base
RUN npm install -g pnpm

# Build stage: install + build together so every workspace's
# node_modules (incl. packages/shared/.bin/tsc) stays intact.
FROM base AS builder
WORKDIR /app

# Manifests first for dependency-layer caching.
# Trimmed workspace file => pnpm only sees public-website + packages/*.
COPY public-website/pnpm-workspace.docker.yaml ./pnpm-workspace.yaml
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY public-website/package.json ./public-website/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile --filter public-website... --filter @iclub/shared

# Source (explicit dirs => never clobbers the trimmed workspace file,
# and backend/members-portal are not needed for the frontend image).
COPY packages/shared ./packages/shared
COPY public-website ./public-website

ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG SOURCE_GIT_REF=main
ARG GITHUB_REPO=iclubmedasu/website

# HF upload may store PNGs as Xet/LFS pointer stubs. Fetch real bytes from GitHub when needed.
RUN SOURCE_GIT_REF="${SOURCE_GIT_REF}" GITHUB_REPO="${GITHUB_REPO}" node public-website/scripts/materialize-public-images.mjs

RUN pnpm --filter @iclub/shared build
RUN pnpm --filter public-website build

# Production stage: slim standalone runtime
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=7860

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public-website/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/public-website/.next/static ./public-website/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public-website/public ./public-website/public

USER nextjs
EXPOSE 7860

CMD ["node", "public-website/server.js"]
