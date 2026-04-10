# Root-level Dockerfile used by Hugging Face Spaces.
# This is the same logic as backend/Dockerfile but:
#   1. Listens on port 7860 (required by HF Spaces)
#   2. Lives at the monorepo root so HF can find it

FROM node:20-alpine AS build

RUN npm install -g pnpm

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY backend/package.json ./backend/package.json
COPY packages/shared/package.json ./packages/shared/package.json

# Install only backend and its workspace deps
RUN pnpm install --frozen-lockfile --filter backend...

# Copy all source files
COPY backend ./backend
COPY packages/shared ./packages/shared

WORKDIR /app/backend
RUN pnpm exec prisma generate
RUN pnpm run build

# ── Runtime stage ───────────────────────────────
FROM node:20-alpine AS runtime

RUN npm install -g pnpm

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7860

COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY backend/package.json ./backend/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN pnpm install --frozen-lockfile --filter backend... --prod

COPY --from=build /app/backend/dist /app/backend/dist
COPY --from=build /app/backend/prisma /app/backend/prisma
COPY --from=build /app/packages/shared /app/packages/shared

WORKDIR /app/backend
RUN pnpm exec prisma generate

EXPOSE 7860

CMD ["node", "-e", "process.env.PORT = process.env.PORT || '7860'; require('./dist/server.js');"]