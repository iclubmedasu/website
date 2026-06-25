# ============================================
# iClub Members Portal - Dockerfile (Next.js)
# Built for Hugging Face Spaces (port 7860)
# ============================================

FROM node:20-alpine AS base
RUN npm install -g pnpm

# Build stage: install + build together so every workspace's
# node_modules (incl. packages/shared/.bin/tsc) stays intact.
FROM base AS builder
WORKDIR /app

# Manifests first for dependency-layer caching.
# Trimmed workspace file => pnpm only sees members-portal + packages/*.
COPY members-portal/pnpm-workspace.docker.yaml ./pnpm-workspace.yaml
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY members-portal/package.json ./members-portal/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile --filter members-portal... --filter @iclub/shared

# Source (explicit dirs => never clobbers the trimmed workspace file,
# and backend/public-website are not needed for the frontend image).
COPY packages/shared ./packages/shared
COPY members-portal ./members-portal

ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter @iclub/shared build
RUN pnpm --filter members-portal build

# Production stage: slim standalone runtime
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=7860

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/members-portal/.next/standalone ./
COPY --from=builder /app/members-portal/.next/static ./members-portal/.next/static
COPY --from=builder /app/members-portal/public ./members-portal/public

USER nextjs
EXPOSE 7860

CMD ["node", "members-portal/server.js"]
