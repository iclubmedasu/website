# ============================================
# iClub Members Portal - Dockerfile
# Multi-stage build for Vite + React
# ============================================

# Stage 1: Build
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy workspace files for pnpm
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./

# Copy package.json files for all workspace packages
COPY members-portal/package.json ./members-portal/
COPY backend/package.json ./backend/
COPY public-website/package.json ./public-website/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY members-portal/ ./members-portal/
COPY packages/ ./packages/

# Build the app
RUN pnpm --filter iclub-frontend build

# Stage 2: Serve
FROM nginx:alpine AS runner

# Copy built files
COPY --from=builder /app/members-portal/dist /usr/share/nginx/html

# Copy nginx config for SPA routing
COPY members-portal/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]