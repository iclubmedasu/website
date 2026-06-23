FROM node:20-alpine AS build

RUN npm install -g pnpm

WORKDIR /app

COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY backend/package.json ./backend/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN pnpm install --frozen-lockfile --filter backend...

COPY backend ./backend
COPY packages/shared ./packages/shared

WORKDIR /app/backend
RUN pnpm exec prisma generate
RUN pnpm run build

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
COPY --from=build /app/backend/assets /app/backend/assets
COPY --from=build /app/packages/shared /app/packages/shared

WORKDIR /app/backend
RUN pnpm exec prisma generate

EXPOSE 7860

CMD ["node", "-e", "process.env.PORT = process.env.PORT || '7860'; require('./dist/server.js');"]