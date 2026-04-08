# Azure Deployment Notes (Backend)

This document lists environment variables used by the backend in production.

Scope used for discovery:
- Backend TypeScript source files under `backend/`
- Based on `process.env` references in runtime code paths
- Excludes compiled output under `backend/dist/`

## Required in production

### DATABASE_URL
- Purpose: PostgreSQL connection string used by Prisma.
- Referenced in: `backend/db.ts`, `backend/prisma.config.ts`
- Example:
  - `postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public`

### JWT_SECRET
- Purpose: Signs and verifies authentication tokens.
- Referenced in: `backend/middleware/auth.ts`, `backend/server.ts`, `backend/routes/projectFiles.ts`
- Notes: A fallback exists in code, but you should always set a strong secret in production.

## Strongly recommended

### NODE_ENV
- Purpose: Enables production behavior (cookies security flags and runtime behavior).
- Referenced in: `backend/server.ts`, `backend/db.ts`, `backend/routes/auth.ts`, `backend/routes/tasks.ts`
- Recommended value: `production`

### PORT
- Purpose: HTTP listen port for the Express server.
- Referenced in: `backend/server.ts`
- Behavior: Backend defaults to `8080` when `PORT` is not provided. Azure App Service usually sets this automatically.

## Optional app-specific variables

### FRONTEND_URL
- Purpose: Adds a single allowed frontend origin for CORS.
- Referenced in: `backend/server.ts`

### FRONTEND_ORIGINS
- Purpose: Comma-separated list of additional CORS origins.
- Referenced in: `backend/server.ts`
- Example:
  - `https://portal.example.com,https://admin.example.com`

### DEVELOPER_EMAIL
- Purpose: Developer backdoor email identity used by auth flow.
- Referenced in: `backend/server.ts`, `backend/routes/auth.ts`
- Default in code: `dev@iclub.com`

### DEVELOPER_PASSWORD
- Purpose: Developer backdoor password used by auth flow.
- Referenced in: `backend/routes/auth.ts`
- Default in code: `dev123456`
- Recommendation: Set a secure value or remove/disable this flow for production.

## GitHub storage integration variables

Set these only if you use the related file/photo storage features.

### GITHUB_STORAGE_OWNER
### GITHUB_STORAGE_REPO
### GITHUB_STORAGE_TOKEN
- Purpose: GitHub repo integration for project file storage.
- Referenced in: `backend/services/githubStorageService.ts`, `backend/server.ts`

### GITHUB_USER_DATA_TOKEN
### GITHUB_USER_DATA_OWNER
### GITHUB_USER_DATA_REPO
- Purpose: GitHub repo integration for profile photo storage.
- Referenced in: `backend/services/githubStorage.ts`
- Default for `GITHUB_USER_DATA_REPO`: `user-data`

## Azure App Service Configuration Tip

Set these values in Azure App Service under:
- App Service -> Configuration -> Application settings

After updating settings, restart the app service to apply changes.
