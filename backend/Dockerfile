# ============================================
# iClub Backend API - Dockerfile
# Express + TypeScript + Prisma
# ============================================

FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./

# Copy package.json files
COPY backend/package.json ./backend/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies (build requires TypeScript toolchain)
RUN pnpm install --frozen-lockfile

# Copy source
COPY backend/ ./backend/
COPY packages/ ./packages/

# Build TypeScript
RUN pnpm --filter backend build

FROM node:20-alpine AS runner

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./

# Copy package.json files
COPY backend/package.json ./backend/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy runtime artifacts
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/backend/prisma.config.ts ./backend/prisma.config.ts
COPY --from=builder /app/packages ./packages

# Generate Prisma client in runtime image
RUN pnpm --filter backend prisma generate

WORKDIR /app/backend

EXPOSE 3000

# Run database migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
