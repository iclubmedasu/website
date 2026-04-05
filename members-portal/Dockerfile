# ============================================
# iClub Members Portal - Dockerfile (Next.js)
# ============================================

FROM node:20-alpine AS base
RUN npm install -g pnpm

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY members-portal/package.json ./members-portal/
COPY backend/package.json ./backend/
COPY public-website/package.json ./public-website/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/members-portal/node_modules ./members-portal/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter members-portal build

# Production stage
FROM base AS runner
WORKDIR /app/members-portal
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/members-portal/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/members-portal/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/members-portal/.next/static ./.next/static

USER nextjs
EXPOSE 3001
ENV PORT=3001

CMD ["node", "server.js"]
