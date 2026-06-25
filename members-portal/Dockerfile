# ============================================
# iClub Members Portal - Dockerfile (Next.js)
# Built for Hugging Face Spaces (port 7860)
# ============================================

FROM node:20-alpine AS base
RUN npm install -g pnpm

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY members-portal/pnpm-workspace.docker.yaml ./pnpm-workspace.yaml
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY members-portal/package.json ./members-portal/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile --filter members-portal... --filter @iclub/shared

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/members-portal/node_modules ./members-portal/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @iclub/shared build
RUN pnpm --filter members-portal build

# Production stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/members-portal/.next/standalone ./
COPY --from=builder /app/members-portal/.next/static ./members-portal/.next/static
COPY --from=builder /app/members-portal/public ./members-portal/public

USER nextjs
EXPOSE 7860
ENV PORT=7860

CMD ["node", "members-portal/server.js"]
